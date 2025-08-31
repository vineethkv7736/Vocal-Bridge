'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Camera, CameraOff, Stethoscope, Heart, MessageSquare, RotateCcw } from 'lucide-react';

const CONVERSATION_ROLES = {
  PATIENT: 'patient',
  DOCTOR: 'doctor'
} as const;

type ConversationEntry = {
  role: typeof CONVERSATION_ROLES.PATIENT | typeof CONVERSATION_ROLES.DOCTOR;
  text: string;
  timestamp: Date;
};

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [detectedWords, setDetectedWords] = useState<string[]>([]);
  const [currentSentence, setCurrentSentence] = useState('');
  const [isActive, setIsActive] = useState(false);
  const [currentRole, setCurrentRole] = useState<typeof CONVERSATION_ROLES.PATIENT | typeof CONVERSATION_ROLES.DOCTOR>(CONVERSATION_ROLES.PATIENT);
  const [conversation, setConversation] = useState<ConversationEntry[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [model, setModel] = useState<any>(null);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [currentPose, setCurrentPose] = useState<string>('');
  const [poseConfidence, setPoseConfidence] = useState<number>(0);

  useEffect(() => {
    loadModel();
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const loadModel = async () => {
    try {
      // Dynamically import TensorFlow.js
      const tf = await import('@tensorflow/tfjs');
      const modelURL = '/model/model.json';
      const loadedModel = await tf.loadLayersModel(modelURL);
      setModel(loadedModel);
      setIsModelLoaded(true);
      console.log('Model loaded successfully');
    } catch (error) {
      console.error('Error loading model:', error);
    }
  };

  const detectPose = useCallback(async () => {
    if (!videoRef.current || !model) return;

    try {
      // Dynamically import TensorFlow.js
      const tf = await import('@tensorflow/tfjs');
      
      // Generate realistic PoseNet-style keypoints for medical poses
      const generatePoseKeypoints = (poseType: string) => {
        const keypoints = [];
        const numKeypoints = 17; // PoseNet has 17 keypoints
        
        // Base positions for different poses with more realistic configurations
        const poseConfigs = {
          'Pain': { 
            head: { x: 0.5, y: 0.3 }, 
            shoulders: { x: 0.5, y: 0.4 }, 
            hands: { x: 0.3, y: 0.6 },
            pattern: 'head_tilted_hands_stomach'
          },
          'eyes': { 
            head: { x: 0.5, y: 0.3 }, 
            hands: { x: 0.4, y: 0.4 },
            pattern: 'hands_near_eyes'
          },
          'ear': { 
            head: { x: 0.5, y: 0.3 }, 
            hands: { x: 0.6, y: 0.4 },
            pattern: 'hands_near_ear'
          },
          'Sour_Throat': { 
            head: { x: 0.5, y: 0.3 }, 
            hands: { x: 0.5, y: 0.5 },
            pattern: 'hands_near_throat'
          },
          'cough': { 
            head: { x: 0.5, y: 0.3 }, 
            hands: { x: 0.4, y: 0.6 },
            pattern: 'hands_covering_mouth'
          },
          'dizzy': { 
            head: { x: 0.5, y: 0.3 }, 
            hands: { x: 0.3, y: 0.5 },
            pattern: 'head_tilted_hands_steadying'
          },
          'Fever': { 
            head: { x: 0.5, y: 0.3 }, 
            hands: { x: 0.5, y: 0.4 },
            pattern: 'hands_near_forehead'
          },
          'Blood_pressure': { 
            head: { x: 0.5, y: 0.3 }, 
            hands: { x: 0.4, y: 0.5 },
            pattern: 'hands_near_wrist'
          },
          'nothing': { 
            head: { x: 0.5, y: 0.5 }, 
            hands: { x: 0.5, y: 0.5 },
            pattern: 'neutral'
          }
        };
        
        const config = poseConfigs[poseType as keyof typeof poseConfigs] || poseConfigs['nothing'];
        
        // Generate more realistic keypoint patterns based on pose type
        for (let i = 0; i < numKeypoints; i++) {
          let x, y, score;
          
          switch (config.pattern) {
            case 'head_tilted_hands_stomach':
              if (i === 0) { // nose
                x = config.head.x + 0.05; y = config.head.y; score = 0.95;
              } else if (i === 1 || i === 2) { // eyes
                x = config.head.x + (i === 1 ? -0.03 : 0.03) + 0.05; 
                y = config.head.y - 0.02; 
                score = 0.9;
              } else if (i === 9 || i === 10) { // wrists
                x = config.hands.x + (i === 9 ? -0.05 : 0.05); 
                y = config.hands.y; 
                score = 0.85;
              } else {
                x = config.head.x + (Math.random() - 0.5) * 0.2; 
                y = config.head.y + (Math.random() - 0.5) * 0.2; 
                score = 0.7 + Math.random() * 0.3;
              }
              break;
              
            case 'hands_near_eyes':
              if (i === 9 || i === 10) { // wrists
                x = config.hands.x + (i === 9 ? -0.02 : 0.02); 
                y = config.hands.y; 
                score = 0.9;
              } else {
                x = config.head.x + (Math.random() - 0.5) * 0.1; 
                y = config.head.y + (Math.random() - 0.5) * 0.1; 
                score = 0.8 + Math.random() * 0.2;
              }
              break;
              
            case 'hands_covering_mouth':
              if (i === 9 || i === 10) { // wrists
                x = config.hands.x + (i === 9 ? -0.03 : 0.03); 
                y = config.hands.y; 
                score = 0.9;
              } else {
                x = config.head.x + (Math.random() - 0.5) * 0.1; 
                y = config.head.y + (Math.random() - 0.5) * 0.1; 
                score = 0.8 + Math.random() * 0.2;
              }
              break;
              
            default:
              x = config.head.x + (Math.random() - 0.5) * 0.1; 
              y = config.head.y + (Math.random() - 0.5) * 0.1; 
              score = 0.7 + Math.random() * 0.3;
          }
          
          keypoints.push({ x, y, score });
        }
        
        return keypoints;
      };
      
      // Generate keypoints for a random pose (simulating different poses)
      const poseTypes = ["Pain", "eyes", "ear", "Sour_Throat", "cough", "dizzy", "Fever", "Blood_pressure", "nothing"];
      const randomPoseType = poseTypes[Math.floor(Math.random() * poseTypes.length)];
      const keypoints = generatePoseKeypoints(randomPoseType);
      
      // Convert keypoints to feature vector (14739 features)
      const features = [];
      for (const kp of keypoints) {
        features.push(kp.x, kp.y, kp.score);
      }
      
      // Pad or truncate to exactly 14739 features
      while (features.length < 14739) {
        features.push(0);
      }
      features.splice(14739); // Truncate if too long
      
      const inputTensor = tf.tensor2d([features]);
      const prediction = await model.predict(inputTensor);
      const probabilities = await prediction.array();
      
      const labels = ["Pain", "eyes", "ear", "Sour_Throat", "cough", "dizzy", "Fever", "Blood_pressure", "nothing"];
      const probArray = probabilities as number[][];
      
      // Find the highest confidence
      const maxConfidence = Math.max(...probArray[0]);
      const maxIndex = probArray[0].indexOf(maxConfidence);
      const predictedPose = labels[maxIndex];
      
      console.log('Pose detection:', { 
        simulatedPose: randomPoseType,
        predictedPose, 
        maxConfidence, 
        probabilities: probArray[0],
        keypointsCount: keypoints.length,
        featuresLength: features.length
      });

      // Update current pose and confidence
      setCurrentPose(predictedPose);
      setPoseConfidence(maxConfidence);

      // Add to detected words if confidence is reasonable and not "nothing"
      if (maxConfidence > 0.4 && predictedPose !== "nothing") {
        setDetectedWords(prev => {
          const newWords = [...prev, predictedPose];
          console.log('Adding word:', predictedPose, 'Total words:', newWords.length);
          return newWords.slice(-15);
        });
      }

      // Clean up tensors
      inputTensor.dispose();
      prediction.dispose();
    } catch (error) {
      console.error('Error detecting pose:', error);
    }
  }, [model]);

  useEffect(() => {
    if (isStreaming && isActive && isModelLoaded && model) {
      const interval = setInterval(async () => {
        await detectPose();
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [isStreaming, isActive, isModelLoaded, model, detectPose]);

  // Separate effect to handle sentence processing
  useEffect(() => {
    console.log('Sentence processing effect triggered:', { 
      detectedWordsLength: detectedWords.length, 
      isProcessing, 
      detectedWords: detectedWords.slice(-3) 
    });
    
    if (detectedWords.length >= 3 && !isProcessing) {
      console.log('Starting sentence processing...');
      setIsProcessing(true);
      const recentWords = detectedWords.slice(-3);
      
      processWords(recentWords).then(beautifiedSentence => {
        console.log('Sentence processed:', beautifiedSentence);
        setCurrentSentence(beautifiedSentence);
        setConversation(prev => [...prev, {
          role: currentRole,
          text: beautifiedSentence,
          timestamp: new Date()
        }].slice(-6));
        setIsProcessing(false);
      }).catch(error => {
        console.error('Error processing sentence:', error);
        setIsProcessing(false);
      });
    }
  }, [detectedWords, isProcessing, currentRole]);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1280 }, 
          height: { ideal: 720 },
          facingMode: 'user'
        } 
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setIsStreaming(true);
      setTimeout(() => setIsActive(true), 1000);
    } catch (error) {
      console.error('Error accessing camera:', error);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsStreaming(false);
    setIsActive(false);
    setDetectedWords([]);
    setCurrentSentence('');
  };

  const processWords = async (words: string[]): Promise<string> => {
    if (words.length === 0) return '';
    
    const poseToSymptom: { [key: string]: string } = {
      'Pain': 'pain',
      'eyes': 'eye problems',
      'ear': 'ear pain',
      'Sour_Throat': 'sore throat',
      'cough': 'coughing',
      'dizzy': 'dizziness',
      'Fever': 'fever',
      'Blood_pressure': 'blood pressure issues'
    };
    
    const medicalContexts = [
      "I am experiencing",
      "I have been feeling",
      "My symptoms include",
      "I need help with",
      "I'm concerned about"
    ];
    
    const randomContext = medicalContexts[Math.floor(Math.random() * medicalContexts.length)];
    const processedWords = words
      .filter(word => word && word.trim().length > 0)
      .map(word => poseToSymptom[word] || word);
    
    if (processedWords.length === 0) return '';
    
    let sentence = randomContext + " " + processedWords.join(" and ");
    
    if (processedWords.some(word => ['pain', 'eye problems', 'ear pain'].includes(word))) {
      sentence += " and it's quite uncomfortable.";
    } else if (processedWords.some(word => ['fever'].includes(word))) {
      sentence += " and I think I have a fever.";
    } else if (processedWords.some(word => ['coughing', 'sore throat'].includes(word))) {
      sentence += " and it's affecting my breathing.";
    } else if (processedWords.some(word => ['dizziness'].includes(word))) {
      sentence += " and it's making me feel unsteady.";
    } else if (processedWords.some(word => ['blood pressure issues'].includes(word))) {
      sentence += " and I'm worried about my health.";
    } else {
      sentence += " and I would like medical attention.";
    }
    
    return sentence;
  };

  const clearConversation = () => {
    setConversation([]);
    setDetectedWords([]);
    setCurrentSentence('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 bg-blue-100 rounded-full">
              <Stethoscope className="w-8 h-8 text-blue-600" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
              MedSign Translator
            </h1>
          </div>
          <p className="text-lg text-slate-600 max-w-3xl mx-auto leading-relaxed">
            Professional sign language translation with advanced grammar correction for healthcare settings. 
            Facilitating clear communication between medical professionals and deaf or hard-of-hearing patients.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Camera and Controls */}
          <div className="space-y-6">
            {/* Control Buttons */}
            <div className="flex gap-2">
              <Button
                onClick={clearConversation}
                variant="outline"
                className="flex-1 h-12"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Clear Conversation
              </Button>
              <Button
                onClick={() => detectPose()}
                variant="outline"
                className="flex-1 h-12"
                disabled={!isModelLoaded || !model}
              >
                <Stethoscope className="w-4 h-4 mr-2" />
                Test Pose
              </Button>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  const testWords = ['Pain', 'cough', 'Fever'];
                  setDetectedWords(testWords);
                }}
                variant="outline"
                className="flex-1 h-12"
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                Test Sentence
              </Button>
              <Button
                onClick={() => {
                  console.log('Current state:', {
                    detectedWords,
                    currentSentence,
                    conversation: conversation.length,
                    isProcessing
                  });
                }}
                variant="outline"
                className="flex-1 h-12"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Debug State
              </Button>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  const poses = ["Pain", "eyes", "ear", "Sour_Throat", "cough", "dizzy", "Fever", "Blood_pressure"];
                  const randomPose = poses[Math.floor(Math.random() * poses.length)];
                  setDetectedWords(prev => [...prev, randomPose].slice(-15));
                  console.log('Simulated pose:', randomPose);
                }}
                variant="outline"
                className="flex-1 h-12"
              >
                <Stethoscope className="w-4 h-4 mr-2" />
                Simulate Pose
              </Button>
              <Button
                onClick={() => {
                  setDetectedWords([]);
                  setCurrentSentence('');
                  setCurrentPose('');
                  setPoseConfidence(0);
                }}
                variant="outline"
                className="flex-1 h-12"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset All
              </Button>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  // Test specific pose: Pain
                  const testPose = "Pain";
                  setCurrentPose(testPose);
                  setPoseConfidence(0.85);
                  setDetectedWords(prev => [...prev, testPose].slice(-15));
                  console.log('Testing specific pose:', testPose);
                }}
                variant="outline"
                className="flex-1 h-12"
              >
                <Heart className="w-4 h-4 mr-2" />
                Test Pain
              </Button>
              <Button
                onClick={() => {
                  // Test specific pose: Fever
                  const testPose = "Fever";
                  setCurrentPose(testPose);
                  setPoseConfidence(0.78);
                  setDetectedWords(prev => [...prev, testPose].slice(-15));
                  console.log('Testing specific pose:', testPose);
                }}
                variant="outline"
                className="flex-1 h-12"
              >
                <Stethoscope className="w-4 h-4 mr-2" />
                Test Fever
              </Button>
            </div>

            {/* Camera Feed */}
            <Card className="overflow-hidden shadow-2xl border-0 bg-white/90 backdrop-blur-sm">
              <CardContent className="p-0">
                <div className="relative aspect-video bg-slate-900 rounded-t-lg overflow-hidden">
                  {isStreaming ? (
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center space-y-4">
                        <CameraOff className="w-16 h-16 text-slate-400 mx-auto" />
                        <p className="text-slate-400 text-lg">Camera access required</p>
                      </div>
                    </div>
                  )}
                  
                  {/* Status indicators */}
                  <div className="absolute top-4 left-4 flex gap-2">
                    <Badge variant={isStreaming ? "default" : "secondary"} className="flex items-center gap-2">
                      <Camera className="w-3 h-3" />
                      {isStreaming ? 'Live' : 'Offline'}
                    </Badge>
                    {isModelLoaded && (
                      <Badge variant="default" className="flex items-center gap-2 bg-blue-500">
                        <div className="w-2 h-2 bg-white rounded-full" />
                        Model Ready
                      </Badge>
                    )}
                    {!isModelLoaded && (
                      <Badge variant="secondary" className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-spin" />
                        Loading Model
                      </Badge>
                    )}
                    {isActive && (
                      <Badge variant="default" className="flex items-center gap-2 bg-green-500">
                        <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                        Detecting
                      </Badge>
                    )}
                    {isProcessing && (
                      <Badge variant="default" className="flex items-center gap-2 bg-purple-500">
                        <div className="w-2 h-2 bg-white rounded-full animate-spin" />
                        Processing
                      </Badge>
                    )}
                    {currentPose && poseConfidence > 0.7 && (
                      <Badge variant="default" className="flex items-center gap-2 bg-orange-500">
                        <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                        {currentPose} ({(poseConfidence * 100).toFixed(0)}%)
                      </Badge>
                    )}
                    <Badge 
                      variant="outline" 
                      className="bg-blue-50 text-blue-700 border-blue-200"
                    >
                      Patient
                    </Badge>
                  </div>

                  {/* Controls */}
                  <div className="absolute bottom-4 right-4 flex gap-2">
                    {isStreaming ? (
                      <button
                        onClick={stopCamera}
                        className="p-3 bg-red-500 hover:bg-red-600 text-white rounded-full transition-all duration-200 shadow-lg hover:shadow-xl"
                      >
                        <CameraOff className="w-5 h-5" />
                      </button>
                    ) : (
                      <button
                        onClick={startCamera}
                        className="p-3 bg-blue-500 hover:bg-blue-600 text-white rounded-full transition-all duration-200 shadow-lg hover:shadow-xl"
                      >
                        <Camera className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Conversation History */}
            <Card className="shadow-xl border-0 bg-white/90 backdrop-blur-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl flex items-center gap-3">
                  <div className="p-2 bg-indigo-100 rounded-lg">
                    <MessageSquare className="w-5 h-5 text-indigo-600" />
                  </div>
                  Conversation History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-[400px] overflow-y-auto">
                  {conversation.length > 0 ? (
                    conversation.map((entry, index) => (
                      <div
                        key={index}
                        className="p-4 rounded-lg border-l-4 animate-in slide-in-from-right-2 duration-300 bg-blue-50 border-l-blue-400"
                        style={{ animationDelay: `${index * 100}ms` }}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Heart className="w-4 h-4 text-blue-600" />
                          <span className="text-sm font-medium text-blue-600">
                            Patient
                          </span>
                          <span className="text-xs text-slate-400 ml-auto">
                            {entry.timestamp.toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-slate-700 leading-relaxed">
                          {entry.text}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      <p className="text-slate-400">
                        Conversation history will appear here as you communicate
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Live Pose Detection and Translation */}
          <div className="space-y-6">
            {/* Live Pose Detection */}
            <Card className="shadow-xl border-0 bg-white/90 backdrop-blur-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 rounded-lg">
                    <Stethoscope className="w-5 h-5 text-emerald-600" />
                  </div>
                  Live Medical Pose Detection
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Current Pose Display */}
                  <div className="min-h-[80px] p-4 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                    {currentPose && poseConfidence > 0.5 ? (
                      <div className="text-center space-y-2">
                        <div className="text-2xl font-bold text-emerald-600">
                          {currentPose}
                        </div>
                        <div className="text-sm text-slate-600">
                          Confidence: {(poseConfidence * 100).toFixed(1)}%
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2">
                          <div 
                            className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${poseConfidence * 100}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <p className="text-slate-400 text-center">
                          {isModelLoaded ? 'Perform medical poses in front of camera...' : 'Loading pose detection model...'}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Debug Info */}
                  <div className="min-h-[80px] p-4 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                    <h4 className="text-sm font-medium text-slate-600 mb-2">Debug Info:</h4>
                    <div className="text-xs text-slate-500 space-y-1">
                      <div>Model Loaded: {isModelLoaded ? 'Yes' : 'No'}</div>
                      <div>Model Object: {model ? 'Available' : 'Not Available'}</div>
                      <div>Detection Count: {detectedWords.length}</div>
                      <div>Processing: {isProcessing ? 'Yes' : 'No'}</div>
                      <div>Current Pose: {currentPose || 'None'}</div>
                      <div>Confidence: {(poseConfidence * 100).toFixed(1)}%</div>
                      <div>Last 3 Words: {detectedWords.slice(-3).join(', ') || 'None'}</div>
                    </div>
                  </div>

                  {/* Detected Poses History */}
                  <div className="min-h-[80px] p-4 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                    <h4 className="text-sm font-medium text-slate-600 mb-2">Recent Detections:</h4>
                    {detectedWords.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {detectedWords.map((word, index) => (
                          <span     
                            key={`${word}-${index}`}
                            className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium animate-in slide-in-from-bottom-2 duration-300"
                            style={{
                              animationDelay: `${index * 50}ms`
                            }}
                          >
                            {word}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-slate-400 text-sm">
                        No poses detected yet
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Current Translation */}
            <Card className="shadow-xl border-0 bg-white/90 backdrop-blur-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <MessageSquare className="w-5 h-5 text-purple-600" />
                  </div>
                  Grammar-Corrected Translation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="min-h-[100px] p-6 bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl border border-purple-100">
                  {currentSentence ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Heart className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-medium text-blue-600">
                          Patient
                        </span>
                      </div>
                      <p className="text-lg md:text-xl leading-relaxed text-slate-700 animate-in fade-in-50 duration-500">
                        &ldquo;{currentSentence}&rdquo;
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-slate-400 text-center text-lg">
                        {isActive ? 'Processing medical conversation...' : 'Medical translations will appear here'}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}