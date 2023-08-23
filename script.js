const fps = document.getElementById('fps');
const view = document.getElementById('view');
const toggle = document.getElementById('toggle');
const checkbox = document.getElementById('check');
const outline = document.getElementById('outline');
const hint = document.getElementById('reloadHint');
const streamCanvas = document.getElementById('stream');
const resultCanvas = document.getElementById('result');
const reloadBtn = document.getElementById('ReloadButton');
const webcamBtn = document.getElementById('webcamButton');
const modelOption = document.getElementById('modelOption');
const modelSelect = document.getElementById('modelSelect');
const screenshotBtn = document.getElementById('screenshotBtn');

const video = document.createElement('video');
const videoCanvas = document.createElement('canvas');

//Configure parameters for model
const bodyPixProperties = {
  architecture: 'MobileNetV1',
  outputStride: 16,
  multiplier: 1,
  quantBytes: 4
};

//Configure parameters for detection
const segmentationProperties = {
  flipHorizontal: true,
  internalResolution: 'high',
  segmentationThreshold: 0.05,
  scoreThreshold: 0.3
};

let model = undefined;

//load bodyPix model
bodyPix.load(bodyPixProperties).then(function (loadedModel) {
  model = loadedModel;
});

// Permission
const constraints =
{
  video: true,
  audio: false
};

//set video attribute
video.width = 800;
video.height = 600;
video.autoplay = true;

//canvas context
const videoCanvasContext = videoCanvas.getContext('2d');
const streamCanvasContext = streamCanvas.getContext('2d');
const resultCanvasContext = resultCanvas.getContext('2d');

// check browser camera permission
webcamBtn.addEventListener('click', function (event) {
  // Asking for permission of camera
  // Yes -> Activate camera stream 
  navigator.mediaDevices.getUserMedia(constraints).then(function (stream) {

    // Hide the button
    event.target.classList.add('removed');   // Add CSS class name

    video.addEventListener('loadedmetadata', function () {

      //show view DOM
      view.style.display = "flex";
      //show modelSelect DOM
      modelSelect.style.display = "flex";
      //show toggle
      toggle.style.display = "inline-block";
      //show button
      screenshotBtn.style.display = "inline-block";

      //initial

      //PARAMETER
      //1. videoCanvas: canvas that copys an immediate frame from webcam
      //2. videoCanvasContext: videoCanvas interface
      //3. streamCanvas: canvas that show the immediate frame from webcam
      //4. streamCanvasContext: streamCanvas interface
      //5. resultCanvas: canvas that outputs the segmental result
      //6. resultCanvasContext: ResultCanvas interface

      videoCanvas.width = video.width;
      videoCanvas.height = video.height;

      streamCanvas.width = video.width;
      streamCanvas.height = video.height;

      resultCanvas.width = video.width;
      resultCanvas.height = video.height;

      //flip canvas horizontally
      flipHorizontal(videoCanvas);
      flipHorizontal(streamCanvas);
      flipHorizontal(resultCanvas);

      //draw one frame to be the initial background
      streamCanvasContext.drawImage(video, 0, 0, video.width, video.height);
      resultCanvasContext.drawImage(video, 0, 0, video.width, video.height);
    });
    // console.log(stream.getVideoTracks());
    video.srcObject = stream;

    // video loaded event
    video.addEventListener('loadeddata', detection);
  });
});

reloadBtn.addEventListener('click', function () {

  bodyPixProperties.architecture = modelOption.value;
  bodyPixProperties.outputStride = (modelOption.value == "MobileNetV1") ? 16 : 32;

  hint.style.display = "block";
  reloadBtn.disabled = true;
  //reload model
  bodyPix.load(bodyPixProperties).then(function (loadedModel) {
    model = loadedModel;
    hint.style.display = "none";
    reloadBtn.disabled = false;
  });
});

screenshotBtn.addEventListener('click', function () {

  //canvas to base64 code
  let url = resultCanvas.toDataURL("image/png");

  //create a element
  let a = document.createElement("a");

  //a attribute
  a.href = url;                 //img url
  a.download = "Saved_Img.png";  //img name
  a.click();
});


let outlineflag = false;

checkbox.addEventListener('change', function () {
  outlineflag = checkbox.checked ? true : false;
});


let FPS = 0;
let duration = 0;
let startTime = null;

function detection() {
  //startTime initial
  if (!startTime) {
    startTime = performance.now();
  }

  // put videoCanvas(data of 1 frame) into segmenting and store return data in segmentation
  videoCanvasContext.drawImage(video, 0, 0, video.width, video.height);

  let segmentFrame = resultCanvasContext.getImageData(0, 0, resultCanvas.width, resultCanvas.height);   // Copy a video frame from webcam to a tempory canvas in memory (not in the DOM)
  let immediateFrame = videoCanvasContext.getImageData(0, 0, videoCanvas.width, videoCanvas.height);    // Get image data from last frame(lastest frame of webcamCanvas)

  model.segmentPerson(videoCanvas, segmentationProperties).then(function (segmentation) {

    let w = resultCanvas.width;

    if (!outlineflag) {
      // Update the human pixel with the old pixel
      // from left to right -> from top to down
      for (let x = 0; x < resultCanvas.width; x++) {
        for (y = 0; y < resultCanvas.height; y++) {

          let n = x + (y * resultCanvas.width);

          // 0: background pixel
          // 1: human pixel
          if (segmentation.data[n] == 0) {
            segmentFrame.data[n * 4] = immediateFrame.data[n * 4];         //R
            segmentFrame.data[n * 4 + 1] = immediateFrame.data[n * 4 + 1]; //G
            segmentFrame.data[n * 4 + 2] = immediateFrame.data[n * 4 + 2]; //B
            segmentFrame.data[n * 4 + 3] = immediateFrame.data[n * 4 + 3]; //A
          }
        }
      }
    }
    else if (outlineflag) {
      //from left to right -> from top to down
      for (let x = 0; x < resultCanvas.width; x++) {
        for (let y = 0; y < resultCanvas.height; y++) {

          let n = x + (y * resultCanvas.width);

          // 0: background pixel  
          // 1: human pixel

          // update the human pixel with the old pixel
          if (segmentation.data[n] == 0) {
            segmentFrame.data[n * 4] = immediateFrame.data[n * 4];         //R
            segmentFrame.data[n * 4 + 1] = immediateFrame.data[n * 4 + 1]; //G
            segmentFrame.data[n * 4 + 2] = immediateFrame.data[n * 4 + 2]; //B
            segmentFrame.data[n * 4 + 3] = immediateFrame.data[n * 4 + 3]; //A
          }
          // update the edged human pixel with the outline
          else if (segmentation.data[n] == 1) {
            // check edged human pixel
            if (x - 1 < 0 || x + 1 > resultCanvas.width || y - 1 < 0 || y + 1 > resultCanvas.height || segmentation.data[n - 1] == 0 || segmentation.data[n + w - 1] == 0 || segmentation.data[n + w] == 0 || segmentation.data[n + w + 1] == 0 || segmentation.data[n + 1] == 0 || segmentation.data[n - w + 1] == 0 || segmentation.data[n - w] == 0 || segmentation.data[n - w - 1] == 0) {
              immediateFrame.data[n * 4] = 255;   //R
              immediateFrame.data[n * 4 + 1] = 0; //B
              immediateFrame.data[n * 4 + 2] = 0; //G
            }
          }
        }
      }
    }
    FPS++;

    // draw frame
    streamCanvasContext.putImageData(immediateFrame, 0, 0);
    resultCanvasContext.putImageData(segmentFrame, 0, 0);

    duration = performance.now() - startTime;
    if (duration >= 1000) {
      //show FPS
      fps.textContent = "fps:" + FPS;

      //reset
      FPS = 0;
      startTime = performance.now();
    }
    // loop the function
    window.requestAnimationFrame(detection);
  });
}

//flip canvas horizontally
function flipHorizontal(canvas) {
  canvas.getContext("2d").scale(-1, 1);
  canvas.getContext("2d").translate(-videoCanvas.width, 0);
}