
var control = document.getElementById("file-selector");
control.addEventListener("change", function(event) {
    // Когда происходит изменение элементов управления, значит появились новые файлы
    var i = 0,
        files = control.files,
        len = files.length;
    for (; i < len; i++) {
        console.log("Filename: " + files[i].name);
        console.log("Type: " + files[i].type);
        console.log("Size: " + files[i].size + " bytes");
    }

    var reader = new FileReader();
    reader.onload = function(event) {
        var contents = event.target.result;
        console.log("Содержимое файла: " + contents);
        document.getElementById("lc").innerHTML = contents;
    };
 
    reader.onerror = function(event) {
        console.error("Файл не может быть прочитан! код " + event.target.error.code);
    };
 
    reader.readAsText(files[0]);
}, false);

