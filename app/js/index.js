// *Digits are four-element arrays of single digits representing:
// element 0: seconds
// element 1: tens of seconds
// element 2: minutes
// element 3: tens of minutes
var enteredDigits = [0, 0, 5, 0];
var displayedDigits = enteredDigits.slice(0);

var enteringDigits = false;
var hasInnerText;
var then;
var remainingTime;
var timerState;
var requestID;

function onPageShow() {
  hasInnerText = ("innerText" in document.getElementsByTagName("body")[0]) ? true : false;
  timerState = localStorage.getItem('timerState') || 'stopped';
  remainingTime = parseFloat(localStorage.getItem('remainingTime')) || 0;
  switch (timerState) {
    case 'paused':
      showTime(remainingTime);
      break;
    case 'running':
      // If we were running when the page was hidden, then we subtract the time
      // we spent hidden, so the timer accounts for it and remains accurate.
      var now = Date.now();
      remainingTime = remainingTime - (now - (parseInt(localStorage.getItem('hideTime')) || now));
      showTime(remainingTime);
      resumeTimer();
      break;
  }
}

function onPageHide() {
  if (timerState === 'running') {
    pauseTimer();
    localStorage.setItem('timerState', 'running');
    localStorage.setItem('hideTime', Date.now());
  }
}

document.getElementById('resetButton').addEventListener('click', onResetButtonClick, false);
var startPauseButton = document.getElementById('startPauseButton');
startPauseButton.addEventListener('click', onStartPauseButtonClick, false);

function onResetButtonClick() {
  enteringDigits = false;
  stopTimer();
  resetTimer();
}

function onStartPauseButtonClick() {
  enteringDigits = false;
  switch (timerState) {
    case 'stopped':
      startTimer();
      break;
    case 'running':
      pauseTimer();
      break;
    case 'paused':
      resumeTimer();
      break;
  }
}

var inputField = document.getElementById('inputField');

// Listen for touchend on mobile devices so we know when the user taps the time.
document.getElementById('time').addEventListener('touchend', function(event) {
  // We only let the user set the time when the timer is stopped.
  if (timerState !== 'running') {
    // Focus the input field to show the number keyboard on mobile devices.
    inputField.focus();

    // Prevent the default so the event doesn't re-propagate as a click event,
    // which would cause the input field to blur right after being focused.
    event.preventDefault();
  }
}, false);

inputField.addEventListener('keypress', function() {
  // We don't actually have to do anything with the keypress here, as the body's
  // event listener for keypresses will handle these too.

  // Reset the input field value, so it doesn't build up over time.
  // This probably doesn't matter, but it seems like the right thing to do.
  inputField.value = '';
}, false);

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

  switch (code) {
    case 13: // DOM_VK_RETURN
    case 14: // DOM_VK_ENTER
    case 32: // DOM_VK_SPACE
      onStartPauseButtonClick();
      // IE's key events don't support preventDefault.
      if (event.preventDefault)
        event.preventDefault();
      return false;

    case 27: // DOM_VK_ESCAPE
      onResetButtonClick();
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
      // We only let the user set the time when the timer isn't running.
      if (timerState !== 'running') {
        // If the user just started typing a time, reset the timer
        // to all zeros so the user can enter a partial time without
        // some of the previous time potentially hanging around.
        if (!enteringDigits) {
          enteredDigits = [0, 0, 0, 0];
          enteringDigits = true;
        }
        addDigit(parseInt(String.fromCharCode(code)));
        if (timerState === 'paused') {
          timerState = 'stopped';
        }
      }
      // IE's key events don't support preventDefault.
      if (event.preventDefault)
        event.preventDefault();
      return false;
  }

}

function animateTimer(now) {
  var elapsedTime = now - then;
  then = now;

  // The time remaining, to the highest degree of precision.  We use this
  // instead of the displayed time to record the remaining time when we
  // pause/resume the timer so we don't lose an fractions of a second.
  // We also use it to determine when to stop the timer once there's less than
  // a second remaining, even though the display reads 00:00 at that point,
  // and we don't update it anymore, so that we'll finish counting the last
  // second correctly in the event that we start displaying something
  // when the timer hits zero.
  remainingTime = remainingTime - elapsedTime;

  // Ensure remaining time is never less than zero.  I don't know how likely
  // it is, but presumably this could happen if the browser delays calling
  // the requestAnimationFrame callback when the page is in a background tab.
  if (remainingTime < 0) {
    remainingTime = 0;
  }

  showTime(remainingTime);

  if (remainingTime > 0) {
    requestID = requestAnimationFrame(animateTimer);
  } else {
    requestID = 0;
    stopTimer();
  }
}

function startTimer() {
  resumeTimer();
}

function stopTimer() {
  if (requestID) {
    cancelAnimationFrame(requestID);
    requestID = 0;
  }

  timerState = 'stopped';
  startPauseButton.src = 'img/start.svg';
}

function pauseTimer() {
  if (requestID) {
    cancelAnimationFrame(requestID);
    requestID = 0;
  }

  var elapsedTime = performance.now() - then;
  remainingTime = remainingTime - elapsedTime;

  // It seems unlikely that someone would be able to pause the timer
  // after the remaining time has decreased enough to change the displayed time,
  // but before an animation frame has actually updated the displayed time.
  // Nevertheless, it doesn't hurt to update it here, just in case.
  showTime(remainingTime);

  timerState = 'paused';
  startPauseButton.src = 'img/start.svg';

  localStorage.setItem('timerState', 'paused');
  localStorage.setItem('remainingTime', remainingTime);
}

function resumeTimer() {
  then = performance.now();
  requestID = requestAnimationFrame(animateTimer);
  timerState = 'running';
  startPauseButton.src = 'img/pause.svg';
}

function resetTimer() {
  showDigits(enteredDigits);
  remainingTime = (parseInt(enteredDigits[3] + '' + enteredDigits[2]) * 60 + parseInt(enteredDigits[1] + '' + enteredDigits[0])) * 1000;
  localStorage.setItem('remainingTime', remainingTime);
}

function showTime(time) {
  var minutes = time / 1000 / 60 | 0;
  var seconds = time / 1000 % 60 | 0;
  showDigits([
    seconds % 10 | 0,
    seconds / 10 | 0,
    minutes % 10 | 0,
    minutes / 10 | 0,
  ]);
}

function showDigits(digits) {
  if (digits[0] === displayedDigits[0] && digits[1] === displayedDigits[1] &&
      digits[2] === displayedDigits[2] && digits[3] === displayedDigits[3]) {
    return;
  }

  displayedDigits = digits.slice(0);
  document.getElementById("time")[hasInnerText ? "innerText" : "textContent"] = 
    (String(digits[3]) + String(digits[2]) + ":" + String(digits[1]) + String(digits[0]));
}

function addDigit(digit) {
  enteredDigits.unshift(digit);
  enteredDigits.length = 4;
  this.resetTimer();
}
