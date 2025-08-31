import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'MedSign Translator - Medical Sign Language Translation',
  description: 'Professional sign language translation tool for healthcare settings, facilitating communication between medical professionals and deaf or hard-of-hearing patients',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Load required external libraries */}
        <script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@1.3.1/dist/tf.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/@teachablemachine/pose@0.8/dist/teachablemachine-pose.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/@xenova/transformers@2.6.1/dist/transformers.min.js"></script>
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  );
}