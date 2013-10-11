var source = new EventSource('http://localhost:8080');

source.addEventListener('message', function(e) {
  var data = JSON.parse(e.data);
  document.body.innerHTML += data.language + ':' + data.article + '<br>';
}, false);