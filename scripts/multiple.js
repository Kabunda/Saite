function multiple(){
	bj = document.getElementById("vehicle1").checked
	m1735 = document.getElementById("vehicle2").checked
	r20 = document.getElementById("vehicle3").checked

	//console.log (bj,m1735,r20)

	fm = getRandomInt(r20 ? 20 : 10)
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