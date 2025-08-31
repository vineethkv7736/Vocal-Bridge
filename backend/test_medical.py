#!/usr/bin/env python3
"""
Test script for medical sign language processing
"""

import requests
import json

def test_medical_processing():
    """Test the medical sentence processing with various inputs"""
    
    # Test cases - realistic sign language sequences
    test_cases = [
        ["pain", "head", "bad"],
        ["need", "doctor", "help"],
        ["fever", "high", "body"],
        ["stomach", "pain", "nausea"],
        ["want", "nurse", "now"],
        ["cough", "throat", "hurt"],
        ["hospital", "go", "emergency"],
        ["yesterday", "start", "pain"],
        ["very", "bad", "pain"],
        ["cannot", "work", "sick"],
        ["medication", "need", "pain"],
        ["chest", "pain", "breathing"],
        ["today", "worse", "symptoms"],
        ["need", "help", "urgent"],
        ["surgery", "need", "doctor"],
        # Test cases for the specific issue
        ["need", "pain", "medication"],
        ["need", "medication", "pharmacy"],
        ["need", "pain", "medication", "pharmacy"],
        ["pain", "need", "medicine"],
        ["medication", "pharmacy", "need"]
    ]
    
    print("Testing Medical Sign Language Processing with Grammar Correction")
    print("=" * 70)
    
    for i, test_words in enumerate(test_cases, 1):
        print(f"\nTest {i}:")
        print(f"Input words: {test_words}")
        
        try:
            response = requests.post(
                "http://localhost:8000/process-words",
                json={
                    "words": test_words,
                    "context": "medical",
                    "timestamp": "2024-01-01T12:00:00Z"
                },
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                result = response.json()
                print(f"Output: {result['beautified']}")
                print(f"Word count: {result['word_count']}")
                print(f"Unique words: {result['unique_words']}")
            else:
                print(f"Error: {response.status_code} - {response.text}")
                
        except requests.exceptions.ConnectionError:
            print("Error: Backend server not running. Please start the server first.")
            break
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    test_medical_processing()
