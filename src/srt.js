const parser = require('subtitles-parser'); // for SRT, support 'fromSrt' and 'toSrt'
const common = require('./common.js');
const config = require('./config.js');
const translate_api = require('./translate_api.js');
const shell = require('electron').shell
// const os = require('os')
// const ipc = require('electron').ipcRenderer
const path = require('path');

var data = '';
var send_many_request = 0;
var receive_many_request = 0;

exports.translate = function(content) {
  data = parser.fromSrt(content);
  var a_batch_original_text = '';
  for (var index = 0; index < data.length; index++) {
    var element = data[index];
    var only_text = common.remove_tag_keep_text(element.text);
    var new_length = encodeURIComponent(a_batch_original_text + only_text + config.LINE_BREAK).length;
    if (new_length < config.LENGTH_LIMIT_PER_REQUEST) {
      a_batch_original_text += only_text + config.LINE_BREAK;
      // 如果到了最后一行还是没超过 LENGTH_LIMIT_PER_REQUEST
      if (data.length - 1 == index) {
        translate_batch(a_batch_original_text, index+1);
      }
    } else {
      translate_batch(a_batch_original_text, index);
      a_batch_original_text = ''; // 清理掉这一批
    }
  }
}

function translate_batch(a_batch_original_text, line) {
  send_many_request = send_many_request + 1;
  translate_api.google(a_batch_original_text, 'en', 'zh-cn').then(function (result) {
    var result_array = result[0];
    var starting_point = line - result_array.length; // 算出这些结果从哪一行开始
    for (var index = 0; index < result_array.length; index++) {
      var result_text = result_array[index][0];
      var line_position = parseInt(starting_point) + parseInt(index);
      data[line_position].text = result_text + data[line_position].text; // 修改 text 节点，这样 toSRT 的时候能保存下来。
      data[line_position].result = result_text;
    }
    receive_many_request = receive_many_request + 1;
    if (receive_many_request == send_many_request) {
      // 转换结果到 SRT 格式。
      var final_result = parser.toSrt(data);
      // 获得原字幕文件路径
      var onlyPath = path.dirname(app.selectedFile.path);
      // 构造新路径和新文件名
      var new_path = path.join(onlyPath, '(翻译后)' + app.selectedFile.name);
      // 保存文件，并在文件夹中显示文件
      try {
        fs.writeFileSync(new_path, final_result, 'utf-8');
        shell.showItemInFolder(new_path);
      }
      catch (e) {
        alert('Failed to save the file !');
      }
      // 回到初始状态
      app.cancel_file_select(); // from vue
    }
  });
}
