const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Bundle TensorFlow Lite models (the YOLO hazard model in assets/models) as assets
config.resolver.assetExts.push('tflite');

module.exports = config;
