function multiple(){
	bj = document.getElementById("vehicle1").checked
	m1735 = document.getElementById("vehicle2").checked
	r20 = document.getElementById("vehicle3").checked

	fm = 4 + getRandomInt(r20 ? 16 : 6)
	cou = 5
	lms = [5,8,11,17,35]
	if (bj) {
		lms.push(2.5)
		cou++
	}
	if (m1735) {
		lms.push(17)
		lms.push(35)
		cou +=2
	}
	lm = lms[getRandomInt(cou)-1]
	ans = " " + fm + " x " + lm
	document.getElementById("output_multiple").innerHTML = ans
	document.getElementById("output_multiple_otvet").hidden = true
	document.getElementById("output_multiple_otvet").innerHTML = fm * lm
	document.getElementById("ans").value = ""
	document.getElementById("ans").focus()
}
function sow(){
	document.getElementById("output_multiple_otvet").hidden = false
  ans = document.getElementById("ans").value
  ansp = document.getElementById("output_multiple_otvet").innerHTML
  if (Number(ans) == Number(ansp)) 
  document.getElementById("output_multiple_otvet").style.color = "green" 
  else
  document.getElementById("output_multiple_otvet").style.color = "red" 
}

function getRandomInt(max) {
  return Math.floor(Math.random() * max) + 1;
}

let timer = document.getElementById('timer');
let startBtn = document.getElementById('startBtn');
let pauseBtn = document.getElementById('pauseBtn');
let resetBtn = document.getElementById('resetBtn');
let secsec = 0;
let seconds = 0;
let minutes = 0;
let interval;

function updateTime() {
	secsec++;
	if (secsec === 100) {
  	seconds++;
  	secsec = 0;
	}
  
  if (seconds === 60) {
    minutes++;
    seconds = 0;
  }
  timer.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}:${secsec.toString().padStart(2, '0')}`;
}

startBtn.addEventListener('click', () => {
  secsec = 0;
  seconds = 0;
  minutes = 0;
  timer.textContent = '00:00:00';
  interval = setInterval(updateTime, 10);
});

pauseBtn.addEventListener('click', () => {
  clearInterval(interval);
});