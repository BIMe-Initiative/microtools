const functions = require('@google-cloud/functions-framework');
const { graphQuery } = require('./D_GraphQuery_260106_fixed');

// Register HTTP function
functions.http('graphQuery', graphQuery);
