'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Camera, CameraOff, Stethoscope, Heart, MessageSquare, RotateCcw } from 'lucide-react';

// Declare global tmPose and pipeline for TypeScript
declare global {
  interface Window {
    tmPose: any;
    pipeline: any;
  }
}

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
  // Canvas refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelContainerRef = useRef<HTMLDivElement>(null);
  
  // State management
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [isLoadingScripts, setIsLoadingScripts] = useState(true);
  
  // Model and webcam instances (stored in refs to avoid re-renders)
  const modelRef = useRef<any>(null);
  const webcamRef = useRef<any>(null);
  const ctxRef = useRef<any>(null);
  const maxPredictionsRef = useRef<number>(0);
  
  // Pose detection results
  const [currentPose, setCurrentPose] = useState<string>('');
  const [poseConfidence, setPoseConfidence] = useState<number>(0);
  const [predictions, setPredictions] = useState<any[]>([]);
  
  // Conversation management
  const [detectedWords, setDetectedWords] = useState<string[]>([]);
  const [currentSentence, setCurrentSentence] = useState('');
  const [conversation, setConversation] = useState<ConversationEntry[]>([]);
  const [currentRole] = useState<typeof CONVERSATION_ROLES.PATIENT | typeof CONVERSATION_ROLES.DOCTOR>(CONVERSATION_ROLES.PATIENT);
  
  // Control update frequency and prevent duplicates
  const [lastProcessedWords, setLastProcessedWords] = useState<string[]>([]);
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(0);
  const [updateCooldown] = useState<number>(3000); // 3 seconds cooldown between updates
  
  // T5 model status
  const [isT5Ready, setIsT5Ready] = useState(false);
  
  // Animation frame ID for cleanup
  const animationFrameId = useRef<number>();
  
  // Pose-to-symptom mapping
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

  // Initialize the model and webcam (based on the provided JavaScript code)
  const init = useCallback(async () => {
    try {
      // Wait for tmPose to be available
      let attempts = 0;
      const maxAttempts = 50; // Wait up to 5 seconds
      
      while (!window.tmPose && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
        console.log(`Waiting for tmPose... Attempt ${attempts}/${maxAttempts}`);
      }
      
      if (!window.tmPose) {
        console.error('tmPose still not available after waiting');
        setIsModelLoaded(false);
        return;
      }

      console.log('tmPose is now available, loading model...');

      const modelURL = '/model/model.json';
      const metadataURL = '/model/metadata.json';

      // Load the model and metadata with retry
      let model;
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount < maxRetries) {
        try {
          model = await window.tmPose.load(modelURL, metadataURL);
          break;
        } catch (error) {
          retryCount++;
          console.log(`Model loading attempt ${retryCount} failed:`, error);
          if (retryCount >= maxRetries) {
            throw new Error(`Failed to load model after ${maxRetries} attempts`);
          }
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
        }
      }
      
      modelRef.current = model;
      maxPredictionsRef.current = model.getTotalClasses();
      setIsModelLoaded(true);

      console.log('Model loaded successfully, setting up webcam...');

      // Setup webcam
      const size = 400;
      const flip = true;
      const webcam = new window.tmPose.Webcam(size, size, flip);
      await webcam.setup();
      await webcam.play();
      webcamRef.current = webcam;

      // Setup canvas
      if (canvasRef.current) {
        canvasRef.current.width = size;
        canvasRef.current.height = size;
        const ctx = canvasRef.current.getContext('2d');
        ctxRef.current = ctx;
      }

      // Setup label container
      if (labelContainerRef.current) {
        labelContainerRef.current.innerHTML = '';
        for (let i = 0; i < maxPredictionsRef.current; i++) {
          const div = document.createElement('div');
          div.className = 'text-xs text-white bg-black/50 px-2 py-1 rounded mb-1';
          labelContainerRef.current.appendChild(div);
        }
      }

      setIsStreaming(true);
      setIsActive(true);

      // Start the main loop
      loop();

      console.log('Model and webcam initialized successfully');
    } catch (error) {
      console.error('Initialization failed:', error);
      setIsModelLoaded(false);
    }
  }, []);

  // Main loop function (based on the provided JavaScript code)
  const loop = useCallback(async (timestamp?: number) => {
    if (!webcamRef.current || !isStreaming) return;

    try {
      webcamRef.current.update();
      await predict();
      animationFrameId.current = window.requestAnimationFrame(loop);
    } catch (error) {
      console.error('Loop error:', error);
    }
  }, [isStreaming]);

  // Prediction function (based on the provided JavaScript code)
  const predict = useCallback(async () => {
    if (!modelRef.current || !webcamRef.current) return;

    try {
      // Prediction #1: run input through posenet
      const { pose, posenetOutput } = await modelRef.current.estimatePose(webcamRef.current.canvas);
      
      // Prediction #2: run input through teachable machine classification model
      const prediction = await modelRef.current.predict(posenetOutput);
      
      // Update predictions state
      setPredictions(prediction)
      
      // Update label container
      if (labelContainerRef.current) {
        for (let i = 0; i < maxPredictionsRef.current; i++) {
          const child = labelContainerRef.current.childNodes[i] as HTMLElement;
          if (child) {
            const classPrediction = prediction[i].className + ": " + prediction[i].probability.toFixed(2);
            child.innerHTML = classPrediction;
          }
        }
      }

      // Find best prediction
      let maxConfidence = 0;
      let predictedPose = '';
      
      for (const pred of prediction) {
        if (pred.probability > maxConfidence) {
          maxConfidence = pred.probability;
          predictedPose = pred.className;
        }
      }

      // Update pose state
      setCurrentPose(predictedPose);
      setPoseConfidence(maxConfidence);

      // Add to detected words if confident enough and not a duplicate
      if (maxConfidence > 0.6 && predictedPose !== "nothing") {
        setDetectedWords(prev => {
          // Check if this is a new word or if enough time has passed
          const isNewWord = !prev.includes(predictedPose);
          const timeSinceLastUpdate = Date.now() - lastUpdateTime;
          const shouldUpdate = isNewWord || timeSinceLastUpdate > updateCooldown;
          
          if (shouldUpdate) {
            const newWords = [...prev, predictedPose];
            setLastUpdateTime(Date.now());
            return newWords.slice(-20);
          }
          return prev;
        });
      }

      // Draw pose
      drawPose(pose);
      
    } catch (error) {
      console.error('Prediction error:', error);
    }
  }, []);

  // Draw pose function (based on the provided JavaScript code)
  const drawPose = useCallback((pose: any) => {
    if (!webcamRef.current || !ctxRef.current || !canvasRef.current) return;

    try {
      // Draw webcam frame
      ctxRef.current.drawImage(webcamRef.current.canvas, 0, 0);
      
      // Draw keypoints and skeleton
      if (pose) {
        const minPartConfidence = 0.5;
        window.tmPose.drawKeypoints(pose.keypoints, minPartConfidence, ctxRef.current);
        window.tmPose.drawSkeleton(pose.keypoints, minPartConfidence, ctxRef.current);
      }
    } catch (error) {
      console.error('Draw pose error:', error);
    }
  }, []);

  // Stop webcam
  const stopWebcam = useCallback(() => {
    setIsStreaming(false);
    setIsActive(false);
    
    // Stop animation frame
    if (animationFrameId.current) {
      window.cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = undefined;
    }
    
    // Stop webcam
    if (webcamRef.current) {
      webcamRef.current.stop();
      webcamRef.current = null;
    }
    
    // Clear state
    setDetectedWords([]);
    setCurrentSentence('');
    setCurrentPose('');
    setPoseConfidence(0);
    setPredictions([]);
    
    console.log('Webcam stopped');
  }, []);

  // Process words into sentences using T5 model for grammar correction
  const processWords = useCallback(async (words: string[]): Promise<string> => {
    if (words.length === 0) return '';
    
    try {
      // Filter out duplicates and empty words, then map to symptoms
      const uniqueWords = Array.from(new Set(words)); // Remove duplicates
      const processedWords = uniqueWords
        .filter(word => word && word.trim().length > 0)
        .map(word => poseToSymptom[word] || word);
      
      if (processedWords.length === 0) return '';
      
      console.log('Original words:', words);
      console.log('Unique words after filtering:', uniqueWords);
      console.log('Processed symptoms:', processedWords);
      
      // Create a simple sentence that T5 can improve
      let basicSentence = `I have ${processedWords.join(' and ')}`;
      
      // Use T5 model for grammar correction if available
      if (window.pipeline) {
        console.log('Using T5 model for grammar correction...');
        
        try {
          // Create a more natural medical sentence with unique symptoms
          const medicalSentence = `I am experiencing ${processedWords.join(' and ')} and need medical attention`;
          
          console.log('Input to T5 model:', medicalSentence);
          
          // Use T5 for text-to-text generation (grammar improvement)
          const result = await window.pipeline('text2text-generation', medicalSentence, {
            max_length: 100,
            do_sample: false,
            num_beams: 1
          });
          
          if (result && result[0] && result[0].generated_text) {
            console.log('T5 corrected sentence:', result[0].generated_text);
            return result[0].generated_text;
          }
        } catch (t5Error) {
          console.warn('T5 model failed, using fallback:', t5Error);
        }
      }
      
      // Fallback: Create a grammatically correct sentence manually
      const medicalContexts = [
        "I am experiencing",
        "I have been feeling",
        "My symptoms include",
        "I need help with",
        "I'm concerned about"
      ];
      
      const randomContext = medicalContexts[Math.floor(Math.random() * medicalContexts.length)];
      let sentence = randomContext + " " + processedWords.join(" and ");
      
      // Add context-specific endings
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
    } catch (error) {
      console.error('Error processing words:', error);
      // Return a simple fallback sentence
      return `I need help with ${words.join(' and ')}`;
    }
  }, [poseToSymptom]);

  // Clear conversation
  const clearConversation = useCallback(() => {
    setConversation([]);
    setDetectedWords([]);
    setCurrentSentence('');
    setLastProcessedWords([]);
    setLastUpdateTime(0);
  }, []);
  
  // Manually process current words into sentence (fallback function)
  const processCurrentWords = useCallback(async () => {
    if (detectedWords.length > 1 && !isProcessing) {
      setIsProcessing(true);
      const recentWords = detectedWords.slice(-3);
      
      try {
        const sentence = await processWords(recentWords);
        setCurrentSentence(sentence);
        setConversation(prev => [...prev, {
          role: currentRole,
          text: sentence,
          timestamp: new Date()
        }].slice(-6));
        setLastProcessedWords(recentWords);
        setLastUpdateTime(Date.now());
        
        // Clear detected words after generating sentence to allow new words
        setDetectedWords([]);
      } catch (error) {
        console.error('Failed to process words:', error);
      } finally {
        setIsProcessing(false);
      }
    }
  }, [detectedWords, isProcessing, processWords, currentRole]);

  // Check if scripts are loaded and auto-start
  useEffect(() => {
    const checkScriptsAndInit = async () => {
      // Check if scripts are loaded
      if (typeof window !== 'undefined') {
        console.log('Starting script check...');
        setLoadingError(null);
        
        // First, try to wait for existing scripts
        let attempts = 0;
        const maxWaitAttempts = 30; // Wait up to 3 seconds
        
        while (!window.tmPose && attempts < maxWaitAttempts) {
          await new Promise(resolve => setTimeout(resolve, 100))
          attempts++;
          console.log(`Waiting for existing scripts... Attempt ${attempts}/${maxWaitAttempts}`);
        }
        
        if (window.tmPose) {
          console.log('Existing scripts found, initializing...');
          setIsLoadingScripts(false);
          await init();
          await initT5Model();
        } else {
          console.log('No existing scripts found, loading manually...');
          // Try to manually load scripts
          try {
            await loadScriptsManually();
            // Wait a bit more for scripts to initialize
            await new Promise(resolve => setTimeout(resolve, 1000));
            setIsLoadingScripts(false);
            await init();
            await initT5Model();
          } catch (error) {
            console.error('Failed to load scripts manually:', error);
            setLoadingError('Failed to load required scripts. Please check your internet connection and try again.');
            setIsLoadingScripts(false);
            setIsModelLoaded(false);
          }
        }
      }
    };
    
    checkScriptsAndInit();
  }, [init]);

  // Initialize T5 model for grammar correction
  const initT5Model = useCallback(async () => {
    try {
      if (window.pipeline) {
        console.log('T5 model already initialized');
        return;
      }
      
      // Wait for Transformers.js to be available
      let attempts = 0;
      const maxAttempts = 50;
      
      while (!window.pipeline && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
        console.log(`Waiting for Transformers.js... Attempt ${attempts}/${maxAttempts}`);
      }
      
      if (!window.pipeline) {
        console.warn('Transformers.js not available, T5 model will not be used');
        return;
      }
      
      console.log('Initializing T5 model for grammar correction...');
      
      // Initialize the T5-small model for text-to-text generation
      try {
        window.pipeline = await window.pipeline('text2text-generation', 't5-small', {
          quantized: false,
          progress_callback: (progress: number) => {
            console.log(`T5 model loading progress: ${(progress * 100).toFixed(1)}%`);
          }
        });
        
        console.log('T5 model initialized successfully');
        setIsT5Ready(true);
      } catch (error) {
        console.warn('Failed to initialize T5 model:', error);
        console.log('Grammar correction will use fallback method');
        setIsT5Ready(false);
      }
    } catch (error) {
      console.error('Error initializing T5 model:', error);
    }
  }, []);

  // Manual script loading as fallback
  const loadScriptsManually = async () => {
    return new Promise<void>((resolve, reject) => {
      try {
        console.log('Loading TensorFlow.js...');
        
        // Load TensorFlow.js
        const tfScript = document.createElement('script');
        tfScript.src = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@1.3.1/dist/tf.min.js';
        tfScript.async = true;
        tfScript.onload = () => {
          console.log('TensorFlow.js loaded, loading Teachable Machine Pose...');
          
          // Load Teachable Machine Pose
          const tmScript = document.createElement('script');
          tmScript.src = 'https://cdn.jsdelivr.net/npm/@teachablemachine/pose@0.8/dist/teachablemachine-pose.min.js';
          tmScript.async = true;
          tmScript.onload = () => {
            console.log('Teachable Machine Pose loaded, loading Transformers.js...');
            
            // Load Transformers.js for T5 model
            const transformersScript = document.createElement('script');
            transformersScript.src = 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.6.1/dist/transformers.min.js';
            transformersScript.async = true;
            transformersScript.onload = () => {
              console.log('Transformers.js loaded');
              resolve();
            };
            transformersScript.onerror = reject;
            document.head.appendChild(transformersScript);
          };
          tmScript.onerror = reject;
          document.head.appendChild(tmScript);
        };
        tfScript.onerror = reject;
        document.head.appendChild(tfScript);
      } catch (error) {
        console.error('Error in script loading:', error);
        reject(error);
      }
    });
  };

  // Process sentences when enough words are detected
  useEffect(() => {
    if (detectedWords.length > 1 && !isProcessing) {
      const recentWords = detectedWords.slice(-3); // Still use last 3 words for context
      
      // Check if we have new words to process
      const hasNewWords = recentWords.some(word => !lastProcessedWords.includes(word));
      const timeSinceLastUpdate = Date.now() - lastUpdateTime;
      const shouldProcess = hasNewWords && timeSinceLastUpdate > updateCooldown;
      
      if (shouldProcess) {
        setIsProcessing(true);
        
        processWords(recentWords).then(sentence => {
          setCurrentSentence(sentence);
          setConversation(prev => [...prev, {
            role: currentRole,
            text: sentence,
            timestamp: new Date()
          }].slice(-6));
          setLastProcessedWords(recentWords);
          setLastUpdateTime(Date.now());
          setIsProcessing(false);
          
          // Clear detected words after generating sentence to allow new words
          setDetectedWords([]);
        }).catch(() => {
          setIsProcessing(false);
        });
      }
    }
  }, [detectedWords, isProcessing, processWords, currentRole, lastProcessedWords, lastUpdateTime, updateCooldown]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameId.current) {
        window.cancelAnimationFrame(animationFrameId.current);
      }
      if (webcamRef.current) {
        webcamRef.current.stop();
      }
    };
  }, []);

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
                 onClick={isStreaming ? stopWebcam : init}
                 variant="outline"
                 className="flex-1 h-12"
                 disabled={!isModelLoaded}
               >
                 {isStreaming ? (
                   <>
                     <CameraOff className="w-4 h-4 mr-2" />
                     Stop Camera
                   </>
                 ) : (
                   <>
                     <Camera className="w-4 h-4 mr-2" />
                     {isModelLoaded ? 'Start Camera' : 'Loading...'}
                   </>
                 )}
               </Button>
             </div>
             
             

            {/* Loading and status indicators */}
            {!isModelLoaded && (
              <div className={`text-center p-4 border rounded-lg ${
                loadingError ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'
              }`}>
                {loadingError ? (
                  <>
                    <p className="text-sm text-red-700 mb-2">
                      {loadingError}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        onClick={async () => {
                          setLoadingError(null);
                          setIsLoadingScripts(true);
                          try {
                            await loadScriptsManually();
                            await init();
                          } catch (error) {
                            console.error('Retry failed:', error);
                          }
                        }}
                        variant="outline"
                        size="sm"
                        className="flex-1"
                      >
                        Try Again
                      </Button>
                      <Button
                        onClick={() => {
                          console.log('Script status:', {
                            tmPose: !!window.tmPose,
                            tf: !!(window as any).tf,
                            windowKeys: Object.keys(window).filter(k => k.includes('tm') || k.includes('tf'))
                          });
                        }}
                        variant="outline"
                        size="sm"
                        className="flex-1"
                      >
                        Check Status
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-yellow-700">
                      {isLoadingScripts ? 'Loading Teachable Machine scripts...' : 'Loading model...'}
                    </p>
                    <p className="text-xs text-yellow-600 mt-1">
                      This may take a few seconds on first load
                    </p>
                    <div className="flex gap-2 mt-2">
                      <Button
                        onClick={() => {
                          console.log('Script status:', {
                            tmPose: !!window.tmPose,
                            tf: !!(window as any).tf,
                            windowKeys: Object.keys(window).filter(k => k.includes('tm') || k.includes('tf'))
                          });
                        }}
                        variant="outline"
                        size="sm"
                        className="flex-1"
                      >
                        Check Script Status
                      </Button>
                      <Button
                        onClick={async () => {
                          try {
                            setIsLoadingScripts(true);
                            setLoadingError(null);
                            await loadScriptsManually();
                            await init();
                          } catch (error) {
                            console.error('Manual retry failed:', error);
                          }
                        }}
                        variant="outline"
                        size="sm"
                        className="flex-1"
                      >
                        Retry Loading
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
            
                         {isModelLoaded && !isStreaming && (
               <div className="text-center">
                 <p className="text-sm text-blue-600">
                   Camera will start automatically in a few seconds...
                 </p>
               </div>
             )}
             
                           {/* Update Status */}
              {isModelLoaded && isStreaming && detectedWords.length > 1 && (
                <div className="text-center p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-700">
                    {(() => {
                      const timeSinceLastUpdate = Date.now() - lastUpdateTime;
                      const timeUntilNextUpdate = Math.max(0, updateCooldown - timeSinceLastUpdate);
                      
                      if (timeUntilNextUpdate === 0) {
                        return 'Ready to process new words';
                      } else {
                        const secondsLeft = Math.ceil(timeUntilNextUpdate / 1000);
                        return `Next update available in ${secondsLeft} second${secondsLeft !== 1 ? 's' : ''}`;
                      }
                    })()}
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    Cooldown: {updateCooldown / 1000}s | Words detected: {detectedWords.length} | Auto-processing: {detectedWords.length > 1 ? 'Enabled' : 'Disabled'}
                  </p>
                </div>
              )}

            {/* Camera Feed */}
            <Card className="overflow-hidden shadow-2xl border-0 bg-white/90 backdrop-blur-sm">
              <CardContent className="p-0">
                <div className="relative aspect-video bg-slate-900 rounded-t-lg overflow-hidden">
                  {isStreaming ? (
                    <div className="w-full h-full flex items-center justify-center">
                      {/* Main canvas for video and pose display */}
                      <canvas
                        ref={canvasRef}
                        className="w-full h-full object-cover"
                      />
                      
                      {/* Label container overlay */}
                      <div 
                        ref={labelContainerRef}
                        className="absolute top-4 right-4 flex flex-col gap-1"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center space-y-4">
                        <CameraOff className="w-16 h-16 text-slate-400 mx-auto" />
                        <p className="text-slate-400 text-lg">
                          {isModelLoaded ? 'Starting camera...' : 'Loading model...'}
                        </p>
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
                     {isT5Ready && (
                       <Badge variant="default" className="flex items-center gap-2 bg-purple-500">
                         <div className="w-2 h-2 bg-white rounded-full" />
                         T5 Ready
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
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                      Patient
                    </Badge>
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

                  {/* All Predictions */}
                  <div className="min-h-[100px] p-4 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                    <h4 className="text-sm font-medium text-slate-600 mb-2">All Predictions:</h4>
                    {predictions.length > 0 ? (
                      <div className="space-y-1">
                        {predictions.map((pred, index) => (
                          <div key={index} className="flex justify-between items-center text-xs">
                            <span className="font-medium">{pred.className}:</span>
                            <span className="text-slate-600">{(pred.probability * 100).toFixed(1)}%</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-slate-400 text-sm">
                        No predictions yet
                      </p>
                    )}
                  </div>

                                     {/* Detected Poses History */}
                   <div className="min-h-[80px] p-4 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                     <h4 className="text-sm font-medium text-slate-600 mb-2">Recent Detections:</h4>
                     {detectedWords.length > 0 ? (
                       <div className="space-y-3">
                         {/* Original detected words */}
                         <div>
                           <h5 className="text-xs font-medium text-slate-500 mb-1">All Detections:</h5>
                           <div className="flex flex-wrap gap-1">
                             {detectedWords.map((word, index) => (
                               <span
                                 key={`${word}-${index}`}
                                 className="inline-block px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium animate-in slide-in-from-bottom-2 duration-300"
                                 style={{
                                   animationDelay: `${index * 50}ms`
                                 }}
                               >
                                 {word}
                               </span>
                             ))}
                           </div>
                         </div>
                         
                         {/* Unique filtered words */}
                         <div>
                           <h5 className="text-xs font-medium text-slate-500 mb-1">Unique Symptoms (for NLP):</h5>
                           <div className="flex flex-wrap gap-1">
                             {Array.from(new Set(detectedWords))
                               .filter(word => word && word.trim().length > 0)
                               .map(word => poseToSymptom[word] || word)
                               .map((symptom, index) => (
                                 <span
                                   key={`unique-${symptom}-${index}`}
                                   className="inline-block px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium animate-in slide-in-from-bottom-2 duration-300"
                                   style={{
                                     animationDelay: `${index * 50}ms`
                                   }}
                                 >
                                   {symptom}
                                 </span>
                               ))}
                           </div>
                         </div>
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
                   <div className="flex items-center gap-2">
                     <span>Grammar-Corrected Translation</span>
                     {isT5Ready && (
                       <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs px-2 py-1">
                         T5 AI
                       </Badge>
                     )}
                   </div>
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