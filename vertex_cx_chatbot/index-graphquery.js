/**
 * GraphQuery Cloud Function Entry Point
 * This file registers the graphQuery handler with Google Cloud Functions Framework
 */

const functions = require('@google-cloud/functions-framework');

// Import the graphQuery handler from D_GraphQuery_260106_fixed.js
const { graphQuery } = require('./D_GraphQuery_260106_fixed');

// Register the HTTP function
functions.http('graphQuery', graphQuery);

console.log('GraphQuery function registered successfully');
