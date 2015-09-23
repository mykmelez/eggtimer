// Time values are four-element arrays of single digits representing:
// element 0: seconds
// element 1: tens of seconds
// element 2: minutes
// element 3: tens of minutes
var initialTime = [0, 0, 5, 0];
var currentTime;
var intervalID;
var typingDigits = false;
var hasInnerText;

function onLoad() {
  hasInnerText = ("innerText" in document.getElementsByTagName("body")[0]) ? true : false;
  resetTimer();
  resizeTime();
}

function onKeyPress(event) {
  // Let the browser handle key combinations.
  if (event.altKey || event.ctrlKey || event.shiftKey || event.metaKey)
    return;

  var code;
  if (!event.which)
     code = event.keyCode; // IE, Mozilla for ESC key
  else if (event.which > 0)
     code = event.which;   // All others
  else
    // Ignore special keys, which we don't handle.
    return;

  switch(code) {
    case 13: // DOM_VK_RETURN
    case 14: // DOM_VK_ENTER
    case 32: // DOM_VK_SPACE
      typingDigits = false;
      if      (intervalID)  stopTimer();
      else if (isRunOut())  resetTimer();
      else                  startTimer();
      // IE's key events don't support preventDefault.
      if (event.preventDefault)
        event.preventDefault();
      return false;

    case 27: // DOM_VK_ESCAPE
      typingDigits = false;
      stopTimer();
      resetTimer();
      // IE's key events don't support preventDefault.
      if (event.preventDefault)
        event.preventDefault();
      return false;

    case 48: // DOM_VK_0
    case 49: // DOM_VK_1
    case 50: // DOM_VK_2
    case 51: // DOM_VK_3
    case 52: // DOM_VK_4
    case 53: // DOM_VK_5
    case 54: // DOM_VK_6
    case 55: // DOM_VK_7
    case 56: // DOM_VK_8
    case 57: // DOM_VK_9
    //case 96: // DOM_VK_NUMPAD0
    //case 97: // DOM_VK_NUMPAD1
    //case 98: // DOM_VK_NUMPAD2
    //case 99: // DOM_VK_NUMPAD3
    //case 100: // DOM_VK_NUMPAD4
    //case 101: // DOM_VK_NUMPAD5
    //case 102: // DOM_VK_NUMPAD6
    //case 103: // DOM_VK_NUMPAD7
    //case 104: // DOM_VK_NUMPAD8
    //case 105: // DOM_VK_NUMPAD9
      // We only let the user set the time if the timer isn't already
      // running.
      if (!intervalID) {
        // If the user just started typing a time, reset the timer
        // to all zeros so the user can enter a partial time without
        // some of the previous time potentially hanging around.
        if (!typingDigits) {
          initialTime = [0, 0, 0, 0];
          typingDigits = true;
        }
        addDigit(parseInt(String.fromCharCode(code)));
      }
      // IE's key events don't support preventDefault.
      if (event.preventDefault)
        event.preventDefault();
      return false;
  }

}

function onResize() {
  resizeTime();
}

function startTimer() {
  intervalID = window.setInterval(decrementTimer, 1000);
}

function stopTimer() {
  window.clearInterval(intervalID);
  intervalID = null;
}

function decrementTimer() {
  if (--currentTime[0] < 0) {
    currentTime[0] = 9;
    if (--currentTime[1] < 0) {
      currentTime[1] = 5;
      if (--currentTime[2] < 0) {
        currentTime[2] = 9;
        --currentTime[3];
      }
    }
  }

  showTime(currentTime);

  if (isRunOut())
    stopTimer();
}

function resetTimer() {
  currentTime = initialTime.join(",").split(",");
  showTime(currentTime);
}

function showTime(time) {
  document.getElementById("time")[hasInnerText ? "innerText" : "textContent"] = 
    (String(time[3]) + String(time[2]) + ":" + String(time[1]) + String(time[0]));
}

function resizeTime() {
  var time = document.getElementById("time");
  var body = document.getElementsByTagName("body")[0];

  var i = parseInt(time.style.fontSize) || 48;

  // Make the time about 2/3 of the width or height of the window.
  while (time.offsetWidth < body.offsetWidth*2/3 &&
         time.offsetHeight < body.offsetHeight*2/3)
    time.style.fontSize = ++i + "px";

  while (i > 0 && time.offsetWidth > body.offsetWidth*2/3 ||
                  time.offsetHeight > body.offsetHeight*2/3)
    time.style.fontSize = --i + "px";
}

function isRunOut() {
  return (currentTime[0] == 0 &&
          currentTime[1] == 0 &&
          currentTime[2] == 0 &&
          currentTime[3] == 0);
}

function addDigit(digit) {
  initialTime.unshift(digit);
  initialTime.length = 4;
  this.resetTimer();
}
