function print_string(num) {
	for (var i = 0; i < 37; i++) {
		document.getElementById(i).innerHTML = i
		document.getElementById(i).style.color = f(i)
		  if (num.some(cur => cur == i)) {
		      	document.getElementById(i).style.color = "yellow"
		  }
	}
}
function even_odd(num) {
    if (num == 0) return 0
    if (num % 9 == 0)
        return 9
    else
        return num % 9
}
function f(num) {
    //green, black, red = 'зеленое', 'черное', 'красное'
    if (num == 0) return 'green'
    if (num == 10 || num == 28) return 'black'
	if (even_odd(num) % 2) 
		return 'red'
	else
		return 'black'
}
function multi(){
	tmp = document.getElementById('name').value
    tmp1 = neibors(tmp)
	print_string(tmp1) 
}
function neibors(num){
const wr = [0,
                  32, 15 , 19, 4, 21, 2,
                  25, 17, 34, 6, 27, 13,
                  36, 11, 30, 8, 23, 10,
                  5, 24, 16, 33, 1, 20,
                  14, 31, 9, 22, 18, 29,
                  7, 28, 12, 35, 3, 26]
 ans = []
    nid = wr.indexOf(Number(num))
    ans.push(wr.at(nid - 2))
    ans.push(wr.at(nid - 1))
    ans.push(wr[nid])
    ans.push(wr[(nid < 36 ? nid + 1 : 0)])
    ans.push(wr[(nid < 35 ? nid + 2 : (nid == 35 ? 0 : 1))])
 return ans            
}
print_string([37,37])


