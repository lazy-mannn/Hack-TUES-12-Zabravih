"""
Audio Converter

This script scans a directory for audio files and converts them to WAV format.
It only processes audio files and skips all other file types.

Usage:
    python audio_converter.py --input_dir /path/to/audio/files --output_dir /path/to/output
"""

import os
import sys
import argparse
from pathlib import Path
from typing import List, Tuple
import subprocess


def print_info(message):
    print(f"INFO: {message}")

def print_error(message):
    print(f"ERROR: {message}")

def print_debug(message):
    if VERBOSE:
        print(f"DEBUG: {message}")

VERBOSE = False

# Audio formats that can be converted
AUDIO_FORMATS = {
    '.mp3', '.m4a', '.aac', '.flac', '.ogg', '.wma', '.aiff', '.ape', '.opus'
}


def check_dependencies() -> bool:
    """
    Check if required dependencies are installed.
    
    Returns:
        bool: True if dependencies are met, False otherwise
    """
    # Check for ffmpeg
    try:
        subprocess.run(
            ["ffmpeg", "-version"], 
            stdout=subprocess.PIPE, 
            stderr=subprocess.PIPE
        )
        print_info("ffmpeg is installed.")
        return True
    except FileNotFoundError:
        print_error("ffmpeg is not installed. Please install it before running this script.")
        return False


def scan_directory(directory: str) -> Tuple[List[Path], List[Path]]:
    """
    Scan directory for audio files.
    
    Args:
        directory: Path to the directory to scan
        
    Returns:
        Tuple containing lists of audio files and files to skip
    """
    audio_files = []
    skip_files = []
    
    dir_path = Path(directory)
    if not dir_path.exists():
        raise FileNotFoundError(f"Directory not found: {directory}")
    
    for file_path in dir_path.glob('**/*'):
        if file_path.is_file():
            file_ext = file_path.suffix.lower()
            
            if file_ext in AUDIO_FORMATS:
                audio_files.append(file_path)
            elif file_ext == '.wav':
                # Skip existing WAV files
                print_debug(f"Skipping existing WAV file: {file_path}")
                skip_files.append(file_path)
            else:
                # Skip non-audio files
                print_debug(f"Skipping non-audio file: {file_path}")
                skip_files.append(file_path)
    
    print_info(f"Found {len(audio_files)} audio files to convert")
    print_info(f"Skipping {len(skip_files)} files (WAV or non-audio)")
    
    return audio_files, skip_files


def convert_audio_to_wav(input_file: Path, output_file: Path) -> bool:
    """
    Convert audio file to WAV format using ffmpeg.
    
    Args:
        input_file: Path to input audio file
        output_file: Path to output WAV file
        
    Returns:
        bool: True if conversion was successful, False otherwise
    """
    try:
        # Ensure output directory exists
        output_file.parent.mkdir(parents=True, exist_ok=True)
        
        cmd = [
            "ffmpeg",
            "-y",  # Overwrite output file if it exists
            "-i", str(input_file),  # Input file
            "-acodec", "pcm_s16le",  # Output codec (16-bit PCM)
            "-ar", "44100",  # Sample rate (44.1kHz)
            "-ac", "1",  # Mono audio (1 channel)
            str(output_file)  # Output file
        ]
        
        process = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        
        if process.returncode != 0:
            print_error(f"Error converting {input_file}: {process.stderr.decode()}")
            return False
            
        print_info(f"Successfully converted {input_file} to WAV")
        return True
        
    except Exception as e:
        print_error(f"Error converting {input_file}: {str(e)}")
        return False


def process_files(audio_files: List[Path], input_dir: str, output_dir: str, 
                  preserve_structure: bool = True) -> Tuple[int, int]:
    """
    Process all identified audio files for conversion.
    
    Args:
        audio_files: List of audio files to convert
        input_dir: Input directory path 
        output_dir: Output directory path

    Returns:
        Tuple of successful conversions, failed conversions
    """
    input_base = Path(input_dir)
    output_base = Path(output_dir)
    
    success_count = 0
    failure_count = 0
    
    # Process audio files
    for audio_file in audio_files:
        if preserve_structure:
            rel_path = audio_file.relative_to(input_base)
            output_file = output_base / rel_path.with_suffix('.wav')
        else:
          
            output_file = output_base / f"{audio_file.stem}.wav"
        
        if convert_audio_to_wav(audio_file, output_file):
            success_count += 1
        else:
            failure_count += 1
    
    return success_count, failure_count


def parse_arguments() -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(description="Convert audio files to WAV format")
    parser.add_argument('--input_dir', type=str, required=True, 
                        help='Directory containing files to convert')
    parser.add_argument('--output_dir', type=str, required=True, 
                        help='Directory for output WAV files')
    parser.add_argument('--flat', action='store_true',
                        help='Don\'t preserve directory structure')
    parser.add_argument('--verbose', '-v', action='store_true',
                        help='Enable verbose output')
    
    return parser.parse_args()


def main():
    """Main function to run the script."""
    global VERBOSE
    
    try:
        args = parse_arguments()
        
        VERBOSE = args.verbose
        
        print_info(f"Input directory: {args.input_dir}")
        print_info(f"Output directory: {args.output_dir}")
        
        if not check_dependencies():
            print_error("Missing dependencies. Please install required packages.")
            sys.exit(1)
        
        # Create output directory if it doesn't exist
        os.makedirs(args.output_dir, exist_ok=True)
        
        audio_files, skip_files = scan_directory(args.input_dir)
        
        # Process files
        preserve_structure = not args.flat
        success_count, failure_count = process_files(
            audio_files, 
            args.input_dir, 
            args.output_dir, 
            preserve_structure
        )
        
        # Print summary
        print_info(f"Conversion complete!")
        print_info(f"Successfully converted: {success_count} files")
        print_info(f"Failed conversions: {failure_count} files")
        
    except Exception as e:
        print_error(f"Error during execution: {str(e)}")
        sys.exit(1)


if __name__ == "__main__":
    main()