
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
    console.log(reader.result);
}, false);

const filePicker$ = document.querySelector('.file-picker')
// настройки
const options = {
  // можно выбирать несколько файлов
  multiple: true,
  // разрешенный тип файлов
  types: [
    {
      description: 'Text',
      accept: {
        'text/plain': '.txt'
        // разрешаем изображения
        // 'image/*': ['.jpg', '.jpeg', '.png', '.gif']
      }
    }
  ],
  // можно выбирать только разрешенные файлы
  // по моим наблюдениям, данная настройка работает не совсем корректно
  excludeAcceptAllOption: true
}

filePicker$.addEventListener('click', async () => {
  const fileHandles = await window.showOpenFilePicker(options)

  const allFilesContent = await Promise.all(
    fileHandles.map(async (fileHandle) => {
      const file = await fileHandle.getFile()
      const fileContent = await file.text()
      return fileContent
    })
  )

  console.log(allFilesContent.join('\n'))
})

const fileSaver$ = document.querySelector('.file-saver')

// настройки
const optionss = {
  // рекомендуемое название файла
  suggestedName: 'test4.txt',
  types: [
    {
      description: 'Text',
      accept: {
        'text/plain': '.txt'
      }
    }
  ],
  excludeAcceptAllOption: true
}

// данные для записи
const fileData = 'Bye World Once Again'

fileSaver$.addEventListener('click', async () => {
  const fileHandle = await window.showSaveFilePicker(optionss)
  const writableStream = await fileHandle.createWritable()

  await writableStream.write(fileData)
  // данный метод не упоминается в черновике спецификации,
  // хотя там говорится о необходимости закрытия потока
  // для успешной записи файла
  await writableStream.close()
})