'use strict';
const express = require('express'); // const bodyParser = require('body-parser'); // const path = require('path');
const environmentVars = require('dotenv').config();
const WebSocket =  require('websocket').client;

const speechClient = new WebSocket('wss://10.22.7.76:9000/v2');

speechClient.onopen = function(e) {
  console.log('Speech Connection to server opened');
}

const app = express();
const port = process.env.PORT || 1337;
const server = require('http').createServer(app);

const io = require('socket.io')(server);

app.use('/assets', express.static(__dirname + '/public'));
app.use('/session/assets', express.static(__dirname + '/public'));
app.set('view engine', 'ejs');

// =========================== ROUTERS ================================ //

app.get('/', function (req, res) {
  res.render('app', {});
});

app.use('/', function (req, res, next) {
  next(); // console.log(`Request Url: ${req.url}`);
});

// =========================== SOCKET.IO ================================ //

io.on('connection', function (client) {
  console.log('Client Connected to server');
  let recognizeStream = null;

  speechClient.on('AudioAdded', function () {
    client.emit('messages', 'Socket Connected to Server');
  });

  speechClient.on('messages', function (data) {
    client.emit('broad', data);
  });

  speechClient.onopen('StartRecognition', function (data) {
    startRecognitionStream(this, data);
  });

  speechClient.on('EndofTranscript', function () {
    stopRecognitionStream();
  });

  speechClient.on('binaryData', function (data) {
    // console.log(data); //log binary data
    if (recognizeStream !== null) {
      recognizeStream.write(data);
    }
  });

  function startRecognitionStream(client) {
    recognizeStream = speechClient
      .streamingRecognize(request)
      .on('error', console.error)
      .on('data', (data) => {
        process.stdout.write(data.results[0] && data.results[0].alternatives[0] ? `Transcription: ${data.results[0].alternatives[0].transcript}\n` : '\n\nReached transcription time limit, press Ctrl+C\n');
        client.emit('speechData', data);

        // if end of utterance, let's restart stream
        // this is a small hack. After 65 seconds of silence, the stream will still throw an error for speech length limit
        if (data.results[0] && data.results[0].isFinal) {
          stopRecognitionStream();
          startRecognitionStream(client);
          // console.log('restarted stream serverside');
        }
      });
  }

  function stopRecognitionStream() {
    if (recognizeStream) {
      recognizeStream.end();
    }
    recognizeStream = null;
  }
});

// =========================== START SERVER ================================ //
server.listen(port, '127.0.0.1', function () {
  //http listen, to make socket work
  // app.address = "127.0.0.1";
  console.log('Server started on port:' + port);
});
