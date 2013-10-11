(function() {

  var ranges = [];
  var botsVsWikipedians = {};

  var createStatsPane = function(language, bots, wikipedians) {
    var div = document.createElement('div');
    var botsImg = document.createElement('img');
    botsImg.src = 'machine.png';
    div.appendChild(botsImg);
    var range = document.createElement('input');
    range.type = 'range';
    div.appendChild(range);
    range.id = language + '-range';
    var wikipediansImg = document.createElement('img');
    wikipediansImg.src = 'man.png';
    div.appendChild(wikipediansImg);
    var lang = document.createElement('span');
    lang.innerHTML = ' ' + language;
    div.appendChild(lang);
    var label = document.createElement('label');
    label.setAttribute('for', '#' + language + '-range');
    label.id = language + '-label';
    label.innerHTML = ' (' + bots + ' vs. ' + wikipedians + ')';
    div.appendChild(label);
    var fragment = document.createDocumentFragment();
    fragment.appendChild(div);
    return fragment;
  };

  setInterval(function() {
    var globalBots = 0;
    var globalWikipedians = 0;

    var updateStats = function(language, bots, wikipedians) {
      var range = document.querySelector('#' + language + '-range');
      range.max = bots + wikipedians;
      range.value = range.max - bots;
      var label = document.querySelector('#' + language + '-label');
      label.innerHTML = ' (' + bots + ' vs. ' + wikipedians + ')';
    };

    ranges.forEach(function(language) {
      var stats = botsVsWikipedians[language];
      updateStats(language, stats.bots, stats.wikipedians);
      globalBots += stats.bots;
      globalWikipedians += stats.wikipedians;
    });
    updateStats('global', globalBots, globalWikipedians);
  }, 1000);

  document.body.appendChild(createStatsPane('global', 0, 0));

  var source = new EventSource('http://localhost:8080');
  source.addEventListener('message', function(e) {
    var data = JSON.parse(e.data);
    if (!document.querySelector('#' + data.language + '-range')) {
      ranges.push(data.language);
      botsVsWikipedians[data.language] = {
        bots: data.isBot ? 1 : 0,
        wikipedians: data.isBot ? 0 : 1
      }
      var stats = botsVsWikipedians[data.language];
      document.body.appendChild(createStatsPane(
          data.language, stats.bots, stats.wikipedians));
    }
    if (data.isBot) {
      botsVsWikipedians[data.language].bots += 1;
    } else {
      botsVsWikipedians[data.language].wikipedians += 1;
    }
  }, false);

})();
