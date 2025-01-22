function iter() {
    var i = Number(document.getElementById("nameI").value)
    var j = Number(document.getElementById("nameJ").value)
    j++
    if (j == 37) {
        j = 0
        i++
        if (i == 37) {
            i = 0
        }
    }
    document.getElementById("nameI").value = i
    document.getElementById("nameJ").value = j
    tmp = neibors(i).concat(neibors(j))
    document.getElementById("consoleP").innerHTML = tmp
    print_string(tmp)
}