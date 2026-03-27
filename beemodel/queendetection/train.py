"""
Audio Classification System

This module trains a neural network model on audio data using YAMNet embeddings.
It extracts features from audio files and trains a classifier to recognize audio classes.

Usage: 
    python main.py --data_path <path_to_data> --model_name <model_name>
    
"""

import os
import sys
import argparse
import logging
from pathlib import Path
from typing import Tuple, List, Dict, Optional, Any

import numpy as np
import pandas as pd
import tensorflow as tf
import librosa
from tqdm import tqdm
from sklearn.preprocessing import LabelBinarizer
from sklearn.utils import shuffle


logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler() 
    ]
)
logger = logging.getLogger(__name__)

# Default configuration
DEFAULT_CONFIG = {
    'yamnet_path': 'yamnet/yamnet.h5',
    'classes_path': 'yamnet/yamnet_class_map.csv',
    'sample_rate': 16000,
    'epochs': 100,
    'batch_size': 32,
    'learning_rate': 0.001,
    'num_hidden': 1024,
    'hidden_layer_size': 512,
    'num_extra_layers': 1,
    'dropout_rate': 0.3,
    'regularization': 0.01,
    'patience': 10,
    'validation_split': 0.2,
    'model_folder': 'model' 
}


class Configuration:
    """Handles configuration for the audio classification system."""
    
    def __init__(self, custom_config: Optional[Dict[str, Any]] = None):
        """
        Initialize configuration handler.
        
        Args:
            custom_config: Custom configuration to override defaults
        """
        self.config = DEFAULT_CONFIG.copy()
        if custom_config:
            self.config.update(custom_config)

    def get(self, key: str, default: Any = None) -> Any:
        return self.config.get(key, default)
    
    def set(self, key: str, value: Any) -> None:
        self.config[key] = value
    
    def __getitem__(self, key: str) -> Any:
        return self.config[key]


class ClassMap:
    """Handles audio class mapping and persistence."""
    
    def __init__(self, config: Configuration):
        """
        Initialize class map.
        
        Args:
            config: Configuration handler
        """
        self.config = config
        self.classes_path = config['classes_path']
        self._ensure_classes_file_exists()
    
    def _ensure_classes_file_exists(self) -> None:
        """Ensure the classes mapping file exists."""
        if not os.path.exists(self.classes_path):
            logger.info(f"Class map file not found: {self.classes_path}. Creating a new one.")
 
            pd.DataFrame({"display_name": [], "index": [], "mid": []}).to_csv(
                self.classes_path, index=False
            )
    
    def load_yamnet_classes(self) -> np.ndarray:
        """Load classes from YAMNet class map CSV file."""
        try:
            df = pd.read_csv(self.classes_path)
            return df["display_name"].values
        except Exception as e:
            logger.error(f"Error loading classes: {str(e)}")
            return np.array([])
    
    def update_classes(self, data_path: str) -> List[str]:
        """
        Update classes based on directory structure.
        
        Args:
            data_path: Path to data directory
            
        Returns:
            List of all class names
        """
        try:
            # Load existing classes mapping
            existing_classes_df = pd.read_csv(self.classes_path)
            existing_classes_set = set(existing_classes_df['display_name'])
            
            # Find new classes
            new_classes = []
            for cls in sorted(os.listdir(data_path)):
                class_path = os.path.join(data_path, cls)
                if os.path.isdir(class_path) and cls not in existing_classes_set:
                    new_classes.append(cls)
            
            # Append new classes to the existing classes dataframe
            if new_classes:
                logger.info(f"Adding {len(new_classes)} new classes: {', '.join(new_classes)}")
                new_classes_df = pd.DataFrame({
                    'display_name': new_classes, 
                    'index': [''] * len(new_classes), 
                    'mid': [''] * len(new_classes)
                })
                updated_classes_df = pd.concat([existing_classes_df, new_classes_df], ignore_index=True)
                updated_classes_df.to_csv(self.classes_path, index=False)
                
            # Return all classes from data directory
            return [cls for cls in sorted(os.listdir(data_path)) 
                    if os.path.isdir(os.path.join(data_path, cls))]
            
        except Exception as e:
            logger.error(f"Error updating classes: {str(e)}")
            raise


class FeatureExtractor:
    """Extracts features from audio files using YAMNet."""
    
    def __init__(self, config: Configuration):
        """
        Initialize feature extractor.
        
        Args:
            config: Configuration handler
        """
        self.config = config
        self.yamnet_model = self._load_yamnet_model()
    
    def _load_yamnet_model(self):
        """Load YAMNet model for feature extraction."""
        try:
            logger.info("Loading YAMNet model...")
            # Import here to avoid circular imports
            from yamnet import yamnet_frames_model
            from params import Params
            
            model = yamnet_frames_model(Params())
            model.load_weights(self.config['yamnet_path'])
            return model
        except Exception as e:
            logger.error(f"Error loading YAMNet model: {str(e)}")
            raise
    
    def extract_features(self, audio_path: str) -> np.ndarray:
        """
        Extract features from an audio file using YAMNet.
        
        Args:
            audio_path: Path to audio file
            
        Returns:
            Numpy array of extracted features
        """
        try:
            # Load audio file
            wav, _ = librosa.load(
                audio_path, 
                sr=self.config['sample_rate'], 
                mono=True
            )
            wav = wav.astype(np.float32)
            
            if len(wav) == 0:
                logger.warning(f"Warning: Empty audio file: {audio_path}")
                return np.array([])
            
            # Extract embeddings using YAMNet
            _, embeddings, _ = self.yamnet_model(wav)
            return embeddings.numpy()
            
        except Exception as e:
            logger.error(f"Error extracting features from {audio_path}: {str(e)}")
            return np.array([])


class DatasetLoader:
    """Creates a dataset from audio files."""
    
    def __init__(self, config: Configuration, feature_extractor: FeatureExtractor):
        """
        Initialize dataset creator.
        
        Args:
            config: Configuration handler
            feature_extractor: Feature extractor
        """
        self.config = config
        self.feature_extractor = feature_extractor
    
    def create_dataset(self, data_path: str, classes: List[str]) -> Tuple[np.ndarray, np.ndarray]:
        """
        Create a dataset from audio files in the specified path.
        
        Args:
            data_path: Path to the directory containing audio files organized in class folders
            classes: List of class names
            
        Returns:
            samples: Numpy array of audio features
            labels: Numpy array of corresponding labels
        """
        samples, labels = [], []
        
        for cls in classes:
            class_path = os.path.join(data_path, cls)
            if not os.path.isdir(class_path):
                continue
                
            logger.info(f"Processing class: {cls}")
            audio_files = os.listdir(class_path)
            
            for sound in tqdm(audio_files, desc=f"Processing {cls}"):
                audio_path = os.path.join(class_path, sound)
                embeddings = self.feature_extractor.extract_features(audio_path)
                
                if len(embeddings) == 0:
                    continue
                
                # Store each embedding frame with its label
                for embedding in embeddings:
                    samples.append(embedding)
                    labels.append(cls)
        
        # Convert to numpy arrays
        if not samples:
            error_msg = "No valid audio samples were processed!"
            logger.error(error_msg)
            raise ValueError(error_msg)
            
        samples = np.asarray(samples)
        labels = np.asarray(labels)
        
        logger.info(f"Created dataset with {len(samples)} samples across {len(set(labels))} classes")
        return samples, labels


class ModelBuilder:
    """Builds and trains neural network models for audio classification."""
    
    def __init__(self, config: Configuration):
        """
        Initialize model builder.
        
        Args:
            config: Configuration handler
        """
        self.config = config
    
    def build_model(self, num_classes: int) -> tf.keras.Model:
        """
        Build a neural network model for audio classification.
        
        Args:
            num_classes: Number of output classes
            
        Returns:
            Keras Model object
        """
        # Input layer (YAMNet embeddings are 1024-dimensional)
        inputs = tf.keras.layers.Input(shape=(1024,))
        
        # First hidden layer with L2 regularization
        x = tf.keras.layers.Dense(
            self.config['num_hidden'], 
            activation='relu',
            kernel_regularizer=tf.keras.regularizers.l2(self.config['regularization'])
        )(inputs)
        x = tf.keras.layers.BatchNormalization()(x)
        x = tf.keras.layers.Dropout(self.config['dropout_rate'])(x)
        
        # Additional hidden layers
        for i in range(self.config['num_extra_layers']):
            layer_size = self.config['hidden_layer_size'] // (i+1)
            x = tf.keras.layers.Dense(
                layer_size, 
                activation='relu',
                kernel_regularizer=tf.keras.regularizers.l2(self.config['regularization'])
            )(x)
            x = tf.keras.layers.BatchNormalization()(x)
            x = tf.keras.layers.Dropout(self.config['dropout_rate'])(x)
        
        # Output layer
        outputs = tf.keras.layers.Dense(num_classes, activation='softmax')(x)
        
        # Create and return model
        model = tf.keras.Model(inputs=inputs, outputs=outputs)
        return model
    
    def _create_callbacks(self, model_path: str) -> List[tf.keras.callbacks.Callback]:
        """
        Create callbacks for model training.
        
        Args:
            model_path: Path to save the model
            
        Returns:
            List of callbacks
        """
        # Create tensorboard callback
        log_dir = Path(f"logs/{os.path.basename(model_path)}")
        log_dir.mkdir(parents=True, exist_ok=True)
        
        tensorboard = tf.keras.callbacks.TensorBoard(
            log_dir=log_dir,
            histogram_freq=1
        )
        
        # Early stopping callback
        early_stopping = tf.keras.callbacks.EarlyStopping(
            monitor='val_accuracy',
            patience=self.config['patience'],
            restore_best_weights=True,
            verbose=1
        )
        
        # Learning rate reduction callback
        reduce_lr = tf.keras.callbacks.ReduceLROnPlateau(
            monitor='val_loss',
            factor=0.5,
            patience=5,
            min_lr=0.00001,
            verbose=1
        )
        
        return [early_stopping, reduce_lr, tensorboard]
    
    def train_model(self, X: np.ndarray, y: np.ndarray, model_name: str) -> Tuple[tf.keras.Model, LabelBinarizer]:
        """
        Train a model on the provided data.
        
        Args:
            X: Input features
            y: Target labels
            model_name: Name of the model
            
        Returns:
            Tuple of (trained model, label encoder)
        """
        # Encode the labels (one-hot encoding)
        encoder = LabelBinarizer()
        encoded_labels = encoder.fit_transform(y)
        num_classes = len(encoder.classes_)
        
        logger.info(f"Training model with {num_classes} classes: {', '.join(encoder.classes_)}")
        
        # Create model
        model = self.build_model(num_classes=num_classes)
        
        # Print model summary
        model.summary()
        
        # Compile model
        optimizer = tf.keras.optimizers.Adam(learning_rate=self.config['learning_rate'])
        model.compile(
            optimizer=optimizer,
            loss=tf.keras.losses.CategoricalCrossentropy(),
            metrics=['accuracy']
        )
        
        model_folder = os.path.join(self.config['model_folder'])
        os.makedirs(model_folder, exist_ok=True)
       
        model_path = os.path.join(model_folder, model_name)
        
        callbacks = self._create_callbacks(model_path)
        
        # Train the model
        history = model.fit(
            X, encoded_labels,
            epochs=self.config['epochs'],
            batch_size=self.config['batch_size'],
            validation_split=self.config['validation_split'],
            callbacks=callbacks,
            verbose=1
        )
        
        # Save the model and class names
        model.save(f"{model_path}.h5")
        np.save(f"{model_path}_classes.npy", encoder.classes_)
        
        # Save training history
        hist_df = pd.DataFrame(history.history)
        hist_df.to_csv(f"{model_path}_history.csv", index=False)
        
        logger.info(f"Model saved as {model_path}.h5")
        logger.info(f"Class names saved as {model_path}_classes.npy")
        
        return model, encoder


def parse_arguments() -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(description="Train an audio classification model")
    parser.add_argument('--data_path', type=str, required=True, 
                        help='Path to the directory containing audio files')
    parser.add_argument('--model_name', type=str, required=True, 
                        help='Name for the saved model')
    parser.add_argument('--config', type=str, 
                        help='Path to config JSON file (optional)')
    parser.add_argument('--epochs', type=int, default=DEFAULT_CONFIG['epochs'],
                        help='Number of training epochs')
    parser.add_argument('--batch_size', type=int, default=DEFAULT_CONFIG['batch_size'],
                        help='Batch size for training')
    parser.add_argument('--learning_rate', type=float, default=DEFAULT_CONFIG['learning_rate'],
                        help='Initial learning rate')
    parser.add_argument('--model_folder', type=str, default=DEFAULT_CONFIG['model_folder'],
                        help='Folder to save the model')
    
    return parser.parse_args()


def load_custom_config(config_path: Optional[str]) -> Dict[str, Any]:
    """Load custom configuration from a JSON file."""
    if not config_path:
        return {}
    
    try:
        import json
        with open(config_path, 'r') as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Error loading config file: {str(e)}")
        return {}


def main():
    """Main function to run the script."""
    try:
     
        args = parse_arguments()
        
        # Load custom configuration
        custom_config = load_custom_config(args.config)
        

        custom_config.update({
            'epochs': args.epochs,
            'batch_size': args.batch_size,
            'learning_rate': args.learning_rate,
            'model_folder': args.model_folder
        })
        
        # Create configuration handler
        config = Configuration(custom_config)
        
        logger.info(f"Data path: {args.data_path}")
        logger.info(f"Model name: {args.model_name}")
        logger.info(f"Model folder: {config['model_folder']}")
        
        # Initialize components
        class_map = ClassMap(config)
        feature_extractor = FeatureExtractor(config)
        dataset_creator = DatasetLoader(config, feature_extractor)
        model_builder = ModelBuilder(config)
        
        # Update classes and get class list
        classes = class_map.update_classes(args.data_path)
        
        # Create dataset
        samples, labels = dataset_creator.create_dataset(args.data_path, classes)
        
        # Shuffle the data for better training
        samples, labels = shuffle(samples, labels, random_state=42)
        
        # Train model
        model, encoder = model_builder.train_model(samples, labels, args.model_name)
        
        logger.info("Training completed successfully!")
        
    except Exception as e:
        logger.error(f"Error during execution: {str(e)}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()