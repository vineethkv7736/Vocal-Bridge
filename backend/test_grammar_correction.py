#!/usr/bin/env python3
"""
Test script for the new grammar correction model
"""

import requests
import json

def test_grammar_correction():
    """Test the grammar correction model with various inputs"""
    
    # Test cases for grammar correction
    test_cases = [
        # Basic grammar issues
        "i need pain medication",
        "me have fever and cough",
        "want go hospital now",
        "pain in my head very bad",
        "need see doctor urgent",
        
        # Medical sign language patterns
        "need pain medication pharmacy",
        "have fever cough throat hurt",
        "want nurse help now",
        "cannot work sick very",
        "need medication from pharmacy",
        
        # Complex sentences
        "yesterday start pain today worse",
        "have pain stomach nausea need medicine",
        "fever high body tired cannot sleep",
        "need doctor help urgent emergency",
        "pain chest breathing hard need hospital"
    ]
    
    print("Testing Grammar Correction Model")
    print("=" * 50)
    
    for i, test_input in enumerate(test_cases, 1):
        print(f"\nTest {i}:")
        print(f"Input: {test_input}")
        
        try:
            response = requests.post(
                "http://localhost:8000/beautify",
                json={"text": test_input},
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                result = response.json()
                print(f"Output: {result['beautified']}")
            else:
                print(f"Error: {response.status_code} - {response.text}")
                
        except requests.exceptions.ConnectionError:
            print("Error: Backend server not running. Please start the server first.")
            break
        except Exception as e:
            print(f"Error: {e}")

def test_structured_processing():
    """Test the structured word processing with grammar correction"""
    
    # Test cases for structured processing
    test_cases = [
        ["need", "pain", "medication"],
        ["have", "fever", "cough"],
        ["want", "doctor", "help"],
        ["pain", "head", "bad"],
        ["need", "medication", "pharmacy"],
        ["cannot", "work", "sick"],
        ["fever", "high", "body"],
        ["need", "hospital", "emergency"]
    ]
    
    print("\n" + "=" * 50)
    print("Testing Structured Word Processing with Grammar Correction")
    print("=" * 60)
    
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
            else:
                print(f"Error: {response.status_code} - {response.text}")
                
        except requests.exceptions.ConnectionError:
            print("Error: Backend server not running. Please start the server first.")
            break
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    test_grammar_correction()
    test_structured_processing()
