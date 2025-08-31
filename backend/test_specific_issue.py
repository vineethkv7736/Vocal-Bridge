#!/usr/bin/env python3
"""
Test script for the specific issue: "I need pain and need medication, pharmacy"
"""

import requests
import json

def test_specific_issue():
    """Test the specific issue that was reported"""
    
    # The problematic case
    test_cases = [
        ["need", "pain", "medication", "pharmacy"],
        ["need", "medication", "pharmacy"],
        ["pain", "need", "medication"],
        ["medication", "pharmacy", "need"],
        ["need", "pain", "medicine"],
        ["need", "medicine", "pharmacy"]
    ]
    
    print("Testing Specific Issue Fix with Grammar Correction")
    print("=" * 50)
    
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
    test_specific_issue()
