function m_comp(){
	by_10 = document.getElementById("v1").checked
	st_25 = document.getElementById("v2").checked
	stav = document.getElementById("v3").checked
	vipl = document.getElementById("v4").checked

	//console.log (bj,m1735,r20)

	num = getRandomInt(37)
	count = 8
	nominal = [25,50,75,100,200,300,400,500]
	if (by_10) {
		nominal.push(10)
		count++
	}
	if (st_25) {
		nominal.push(125,150,175)
		count +=3
	}
	//console.log(nominal)
	nom = nominal[getRandomInt(count)]
	document.getElementById("output_multiple").innerHTML = "#" + num + " по " + nom
	document.getElementById("output_multiple_otvet").hidden = true
	ans = (stav ? c_stavka(num) * nom : "") + " " + (vipl ? c_coplit(num) * nom : "")
	document.getElementById("output_multiple_otvet").innerHTML = ans
}
function sow(){
	document.getElementById("output_multiple_otvet").hidden = false
}

function getRandomInt(max) {
  return Math.floor(Math.random() * max);
}
function c_coplit(num){
	ans = 0
	if (num == 0) {
		ans = 235
	} else if (num == 1 || num == 3) {
		ans = 297
	} else if (num == 2) {
		ans = 396
	} else if (num == 34 || num == 36){
		ans = 198
	} else if (num == 35) {
		ans = 264
	} else if ((num - 5) % 3 == 0) {
		ans = 392
	} else {
		ans = 294
	}
	return ans;
}
function c_stavka(num){
	ans = 0
	if (num == 0) {
		ans = 17
	} else if (num == 1 || num == 3) {
		ans = 27
	} else if (num == 2) {
		ans = 36
	} else if (num == 34 || num == 36){
		ans = 18
	} else if (num == 35) {
		ans = 24
	} else if ((num - 5) % 3 == 0) {
		ans = 40
	} else {
		ans = 30
	}
	return ans;
}