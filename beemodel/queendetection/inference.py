"""
Audio Classification using YAMNet and Custom Models
A streamlined tool for classifying audio using pre-trained and custom models.
"""

import os
import argparse
import logging
from pathlib import Path
from typing import Dict, List, Tuple, Optional, Union, Any
from dataclasses import dataclass, field

import numpy as np
import pandas as pd
import librosa
import resampy
import soundfile as sf
import tensorflow as tf
from tensorflow.keras.models import load_model
from datetime import datetime


logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Suppress TensorFlow warnings
tf.get_logger().setLevel(logging.ERROR)
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'


@dataclass(frozen=True)
class YAMNetParams:
    """Parameters for YAMNet model."""
    sample_rate: float = 16000.0
    stft_window_seconds: float = 0.025
    stft_hop_seconds: float = 0.010
    mel_bands: int = 64
    mel_min_hz: float = 125.0
    mel_max_hz: float = 7500.0
    log_offset: float = 0.001
    patch_window_seconds: float = 0.96
    patch_hop_seconds: float = 0.48
    num_classes: int = 521
    conv_padding: str = 'same'
    batchnorm_center: bool = True
    batchnorm_scale: bool = False
    batchnorm_epsilon: float = 1e-4
    classifier_activation: str = 'sigmoid'
    tflite_compatible: bool = True

    @property
    def patch_frames(self) -> int:
        """Calculate number of frames per patch."""
        return int(round(self.patch_window_seconds / self.stft_hop_seconds))

    @property
    def patch_bands(self) -> int:
        """Get number of mel bands."""
        return self.mel_bands


@dataclass
class Config:
    """Configuration for models and processing parameters."""

    yamnet_model_path: str
    yamnet_classes_path: str
    model_path: Optional[str] = None
    custom_classes_path: Optional[str] = None
    output_dir: str = "results"
    output_file: str = "classification.txt"
    
    # Processing parameters
    window_length: int = 10  # seconds
    hop_length: int = 1  # seconds
    custom_weight_factor: float = 5.0
    top_k: int = 10  # Number of top predictions to keep
    
    # Exclude certain classes
    excluded_classes: List[str] = field(default_factory=lambda: ["Vehicle"])
    
    def __post_init__(self):
        """Convert paths to absolute paths and ensure output directory exists."""
        self.yamnet_model_path = os.path.abspath(self.yamnet_model_path)
        self.yamnet_classes_path = os.path.abspath(self.yamnet_classes_path)

        if self.model_path:
            self.model_path = os.path.abspath(self.model_path)

        if self.custom_classes_path:
            self.custom_classes_path = os.path.abspath(self.custom_classes_path)

        # Add timestamp to output filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        name, ext = os.path.splitext(self.output_file)
        self.output_file = f"{name}_{timestamp}{ext}"

        # Create output directory
        os.makedirs(Path(self.output_dir), exist_ok=True)
    
    @property
    def output_path(self) -> str:
        """Get full path to output file."""
        return os.path.join(self.output_dir, self.output_file)

    @classmethod
    def from_args(cls, args: argparse.Namespace) -> 'Config':
        """Create config from command line arguments."""
        output_dir = os.path.dirname(args.output) or "results"
        output_file = os.path.basename(args.output) or "classification.txt"
        
        return cls(
            yamnet_model_path=args.yamnet_model,
            yamnet_classes_path=args.yamnet_classes,
            model_path=args.model if os.path.exists(args.model) else None,
            custom_classes_path=args.custom_classes if os.path.exists(args.custom_classes) else None,
            output_dir=output_dir,
            output_file=output_file,
            window_length=args.window,
            hop_length=args.hop,
            custom_weight_factor=args.weight
        )


class AudioClassifier:
    """Audio classification using YAMNet and custom models."""
    
    def __init__(self, config: Config):
        """Initialize classifier with configuration."""
        self.config = config
        self.params = YAMNetParams()
        
        # Initialize models
        self.yamnet_model = None
        self.model = None
        self.yamnet_classes = []
        self.custom_classes = []
        
        # Load models
        self._load_models()
    
    def _load_models(self) -> None:
        """Load YAMNet and custom models."""
        # Load YAMNet model
        try:
            from yamnet import yamnet_frames_model, class_names
            
            logger.info(f"Loading YAMNet model from {self.config.yamnet_model_path}")
            self.yamnet_model = yamnet_frames_model(self.params)
            self.yamnet_model.load_weights(self.config.yamnet_model_path)
            
            logger.info(f"Loading YAMNet classes from {self.config.yamnet_classes_path}")
            self.yamnet_classes = class_names(self.config.yamnet_classes_path)
            
        except ImportError:
            logger.error("YAMNet module not found. Please install it or provide correct path.")
            raise
        except Exception as e:
            logger.error(f"Failed to load YAMNet model: {e}")
            raise
        
        # Load custom model if available
        if self.config.model_path:
            try:
                logger.info(f"Loading custom model from {self.config.model_path}")
                self.model = load_model(self.config.model_path)
                
                if self.config.custom_classes_path:
                    logger.info(f"Loading custom classes from {self.config.custom_classes_path}")
                    self.custom_classes = np.load(self.config.custom_classes_path, allow_pickle=True)
                
            except Exception as e:
                logger.warning(f"Failed to load custom model: {e}")
                logger.warning("Continuing with YAMNet model only.")
                self.model = None
                self.custom_classes = []
    
    def classify_file(self, audio_path: str) -> Dict[str, Any]:
        """Classify audio file and return results."""
        logger.info(f"Processing audio file: {audio_path}")

        # Save results alongside the input file
        self.config.output_dir = os.path.dirname(os.path.abspath(audio_path))

        # Load audio
        waveform, sr = self._load_audio(audio_path)

        # Process audio segments
        logger.info("Processing audio segments...")
        segments_results = self._process_audio_segments(waveform, sr)

        # Aggregate results
        logger.info("Aggregating results...")
        final_results = self._aggregate_results(segments_results)
        final_results['audio_path'] = os.path.abspath(audio_path)
        final_results['classified_at'] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        # Save results
        if self.config.output_path:
            self._save_results(final_results)

        return final_results
    
    def _load_audio(self, file_path: str) -> Tuple[np.ndarray, int]:
        """Load and preprocess audio file."""
      
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Audio file not found: {file_path}")
            
        # Load audio data
        logger.info(f"Loading audio from {file_path}")
        wav_data, sr = sf.read(file_path, dtype=np.int16)
        
        # Convert to float32 in range [-1.0, 1.0]
        waveform = wav_data / 32768.0
        waveform = waveform.astype('float32')
        
        # Convert stereo to mono if needed
        if len(waveform.shape) > 1:
            logger.info("Converting stereo audio to mono")
            waveform = np.mean(waveform, axis=1)
        
        # Resample if needed
        if sr != self.params.sample_rate:
            logger.info(f"Resampling audio from {sr}Hz to {self.params.sample_rate}Hz")
            waveform = resampy.resample(waveform, sr, self.params.sample_rate)
            sr = int(self.params.sample_rate)
        
        return waveform, sr
    
    def _process_audio_segments(self, waveform: np.ndarray, sr: int) -> List[Dict[str, Any]]:
        """Process audio in segments."""
        segment_length_samples = int(sr * self.config.window_length)
        hop_length_samples = int(sr * self.config.hop_length)
        
        if segment_length_samples <= 0:
            raise ValueError(f"Invalid segment length: {self.config.window_length} seconds")
        
        segments_results = []
        
        # Process each segment
        total_segments = max(1, (len(waveform) - segment_length_samples + hop_length_samples) // hop_length_samples)
        for i in range(0, len(waveform) - segment_length_samples + 1, hop_length_samples):
            segment_idx = i // hop_length_samples + 1
            logger.debug(f"Processing segment {segment_idx}/{total_segments}")
            
            end_idx = min(i + segment_length_samples, len(waveform))
            window = waveform[i:end_idx]
            
            # Get YAMNet predictions
            yamnet_predictions = self._get_yamnet_predictions(window)
            
            # Get custom model predictions if available
            custom_predictions = None
            if self.model is not None:
                custom_predictions = self._get_custom_predictions(window)
            
            # Combine predictions
            combined_results = self._combine_predictions(yamnet_predictions, custom_predictions)
            
            # Store results
            segment_result = {
                'yamnet_predictions': yamnet_predictions,
                'custom_predictions': custom_predictions,
                'combined_predictions': combined_results
            }
            
            segments_results.append(segment_result)
        
        return segments_results
    
    def _get_yamnet_predictions(self, audio_segment: np.ndarray) -> Dict[str, float]:
        """Get YAMNet predictions for an audio segment."""
        try:
            scores, embeddings, spectrogram = self.yamnet_model(audio_segment)
            prediction = np.mean(scores, axis=0)
            
            # Get top predictions
            top_indices = np.argsort(prediction)[::-1][:self.config.top_k]
            top_labels = [self.yamnet_classes[i] for i in top_indices]
            top_scores = prediction[top_indices]
            
            return {label: float(score) for label, score in zip(top_labels, top_scores)}
            
        except Exception as e:
            logger.error(f"Error in YAMNet prediction: {e}")
            return {}
    
    def _get_custom_predictions(self, audio_segment: np.ndarray) -> Dict[str, float]:
        """Get custom model predictions for an audio segment."""
        try:
            # Get YAMNet embeddings first
            embeddings = self.yamnet_model(audio_segment)[1]
            
            # Reshape embeddings for custom model
            embeddings_reshaped = np.reshape(embeddings, (embeddings.shape[0], -1))
            
            # Get predictions from custom model
            predictions = self.model.predict(embeddings_reshaped, verbose=0)
            
            # Calculate mean prediction over time
            mean_predictions = np.mean(predictions, axis=0)
            
            # Get top predictions
            top_indices = np.argsort(mean_predictions)[::-1][:self.config.top_k]
            
            # Check if custom classes are available
            if len(self.custom_classes) > 0:
                top_labels = [self.custom_classes[i] for i in top_indices]
            else:
                # Use numeric indices as labels if no class names are available
                top_labels = [f"Class_{i}" for i in top_indices]
                
            top_scores = mean_predictions[top_indices]
            
            # Normalize scores
            total_score = np.sum(top_scores)
            if total_score > 0:
                top_scores = top_scores / total_score
            
            return {label: float(score) for label, score in zip(top_labels, top_scores)}
            
        except Exception as e:
            logger.error(f"Error in custom model prediction: {e}")
            return {}
    
    def _combine_predictions(
        self, 
        yamnet_predictions: Dict[str, float], 
        custom_predictions: Optional[Dict[str, float]]
    ) -> Dict[str, float]:
        """Combine predictions from different models."""
        combined = {}
        
        # Add custom predictions with weighting 
        if custom_predictions:
            for label, score in custom_predictions.items():
                combined[label] = score * self.config.custom_weight_factor
        
        # Add YAMNet predictions if not already present or if higher score
        for label, score in yamnet_predictions.items():
            if label not in self.config.excluded_classes:
                if label not in combined or score > combined[label]:
                    combined[label] = score
        
        return combined
    
    def _aggregate_results(self, segments_results: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Aggregate results across all segments."""
        # Initialize aggregated predictions
        aggregated_predictions = {}
        
        # Collect all combined predictions, keeping maximum score per label
        for segment in segments_results:
            for label, score in segment['combined_predictions'].items():
                if label in aggregated_predictions:
                    aggregated_predictions[label] = max(aggregated_predictions[label], score)
                else:
                    aggregated_predictions[label] = score
        
        # Process results
        if aggregated_predictions:
            # Get top predictions
            sorted_predictions = sorted(
                aggregated_predictions.items(),
                key=lambda x: x[1],
                reverse=True
            )[:self.config.top_k]
            
            # Create a new dictionary with only the top predictions
            top_predictions = {label: score for label, score in sorted_predictions}
            
            # Normalize scores
            total_score = sum(top_predictions.values())
            if total_score > 0:
                normalized_predictions = {
                    label: score / total_score 
                    for label, score in top_predictions.items()
                }
            else:
                # Default to equal probabilities if all scores are 0
                normalized_predictions = {
                    label: 1.0 / len(top_predictions) if len(top_predictions) > 0 else 0.0
                    for label in top_predictions
                }
            
            # Find dominant label
            dominant_label, dominant_score = max(normalized_predictions.items(), key=lambda x: x[1])
            dominant_score_percentage = round(dominant_score * 100)
            
            # Replace original predictions with normalized ones
            aggregated_predictions = normalized_predictions
        else:
            dominant_label = "Unknown"
            dominant_score = 0
            dominant_score_percentage = 0
        
        return {
            'aggregated_predictions': aggregated_predictions,
            'dominant_label': dominant_label,
            'dominant_score': dominant_score,
            'dominant_score_percentage': dominant_score_percentage
        }
    
    def _save_results(self, results: Dict[str, Any]) -> None:
        """Save classification results to file."""
        try:
            with open(self.config.output_path, 'w') as file:
                file.write("Audio Classification Results\n")
                file.write("=========================\n\n")
                file.write(f"Input File: {results['audio_path']}\n")
                file.write(f"Classified At: {results['classified_at']}\n\n")
                file.write(f"Primary Classification: {results['dominant_label']} ({results['dominant_score_percentage']}%)\n\n")

                # Add detailed breakdown
                file.write("Classification Details:\n")
                file.write("-----------------\n")
                sorted_predictions = sorted(
                    results['aggregated_predictions'].items(), 
                    key=lambda x: x[1], 
                    reverse=True
                )
                
                for label, score in sorted_predictions:
                    percentage = round(score * 100)
                    file.write(f"{label}: {percentage}%\n")
                
            logger.info(f"Results saved to {self.config.output_path}")
            
        except Exception as e:
            logger.error(f"Error saving results: {e}")
            raise


def main():
    """Main function to run audio classification."""
    script_dir = os.path.dirname(os.path.abspath(__file__))

    parser = argparse.ArgumentParser(
        description='Audio classification using YAMNet and custom models',
        formatter_class=argparse.ArgumentDefaultsHelpFormatter
    )

    # Required arguments
    parser.add_argument('audio_file', type=str, help='Path to audio file for classification')

    # Model paths
    parser.add_argument('--yamnet_model', type=str, default=os.path.join(script_dir, 'yamnet/yamnet.h5'),
                        help='Path to YAMNet model weights')
    parser.add_argument('--yamnet_classes', type=str, default=os.path.join(script_dir, 'yamnet/yamnet_class_map.csv'),
                        help='Path to YAMNet class names')
    parser.add_argument('--model', type=str, default=os.path.join(script_dir, 'model/model.h5'),
                        help='Path to custom model (optional)')
    parser.add_argument('--custom_classes', type=str, default=os.path.join(script_dir, 'model/model.npy'),
                        help='Path to custom class names (optional)')
    
    # Processing parameters
    parser.add_argument('--window', type=int, default=10, 
                        help='Window length in seconds')
    parser.add_argument('--hop', type=int, default=1, 
                        help='Hop length in seconds')
    parser.add_argument('--weight', type=float, default=5.0,
                        help='Weighting factor for custom model predictions')
    
    # Output options
    parser.add_argument('--output', type=str, default='results/classification.txt', 
                        help='Path to output file')
    
    # Logging options
    parser.add_argument('--verbose', action='store_true', 
                        help='Enable verbose output')
    parser.add_argument('--debug', action='store_true', 
                        help='Enable debug logging')
    
    args = parser.parse_args()
    
    # Configure logging
    if args.debug:
        logger.setLevel(logging.DEBUG)
    elif args.verbose:
        logger.setLevel(logging.INFO)
    else:
        logger.setLevel(logging.WARNING)
    
    try:
        # Create configuration
        config = Config.from_args(args)
        
        # Create classifier
        classifier = AudioClassifier(config)
        
        # Process audio file
        results = classifier.classify_file(args.audio_file)
        
        # Always print just the label for easy machine consumption
        print(results['dominant_label'])

        if args.verbose:
            import sys
            print("\nAudio Classification Results", file=sys.stderr)
            print("=========================", file=sys.stderr)
            print(f"Score: {results['dominant_score_percentage']}%", file=sys.stderr)
            print("\nTop 10 Predictions:", file=sys.stderr)
            print("-----------------", file=sys.stderr)
            sorted_predictions = sorted(
                results['aggregated_predictions'].items(),
                key=lambda x: x[1],
                reverse=True
            )
            for label, score in sorted_predictions:
                percentage = round(score * 100)
                print(f"{label}: {percentage}%", file=sys.stderr)
            print(f"\nFull results saved to: {config.output_path}", file=sys.stderr)
        
    except Exception as e:
        logger.error(f"Error: {e}")
        if args.debug:
            import traceback
            traceback.print_exc()
        return 1
    
    return 0


if __name__ == '__main__':
    import sys
    sys.exit(main())