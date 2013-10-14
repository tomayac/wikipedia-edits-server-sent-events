(function() {

  var ranges = [];
  var botsVsWikipedians = {};

  var contentDiv = document.querySelector('#content');
  var considerWikidata = document.querySelector('#consider-wikidata');

  considerWikidata.addEventListener('change', function() {
    if (considerWikidata.checked) {
      document.querySelector('.wikidata').style.display = 'block';
    } else {
      document.querySelector('.wikidata').style.display = 'none';
    }
  });

  var createStatsPane = function(language, bots, wikipedians) {
    var div = document.createElement('div');
    if (language === 'global') {
      div.style.marginBottom = '2em';
    }
    if (language === 'wikidata') {
      div.setAttribute('class', 'wikidata');
    }
    var botsImg = document.createElement('img');
    botsImg.src = 'bots.png';
    botsImg.setAttribute('class', 'icon');
    div.appendChild(botsImg);
    var range = document.createElement('input');
    range.type = 'range';
    div.appendChild(range);
    range.id = language + '-range';
    var wikipediansImg = document.createElement('img');
    wikipediansImg.src = 'wikipedians.png';
    wikipediansImg.setAttribute('class', 'icon');
    div.appendChild(wikipediansImg);
    var logo = document.createElement('img');
    logo.src = language === 'wikidata' ? 'wikidata.png' : 'wikipedia.png';
    logo.setAttribute('class', 'icon logo');
    div.appendChild(logo);
    var lang;
    if (language !== 'global') {
      lang = document.createElement('a');
      lang.href = language === 'wikidata' ?
          'http://' + language + '.org/' :
          'http://' + language + '.wikipedia.org/';
      lang.textContent = language;
      lang.setAttribute('target', '_blank');
    } else {
      lang = document.createElement('span');
      lang.textContent = language;
    }
    div.appendChild(lang);
    var label = document.createElement('label');
    label.setAttribute('for', '#' + language + '-range');
    label.id = language + '-label';
    label.innerHTML = updateStatsHtml(bots, wikipedians);
    div.appendChild(label);
    var fragment = document.createDocumentFragment();
    fragment.appendChild(div);
    return fragment;
  };

  var updateStatsHtml = function(bots, wikipedians) {
    return ' <small>(' + bots + ' <i>vs.</i> ' + wikipedians +
        ')</small>';
  };

  setInterval(function() {
    var globalBots = 0;
    var globalWikipedians = 0;

    var updateStats = function(language, bots, wikipedians) {
      var range = document.querySelector('#' + language + '-range');
      range.max = bots + wikipedians;
      range.value = range.max - bots;
      var label = document.querySelector('#' + language + '-label');
      label.innerHTML = updateStatsHtml(bots, wikipedians);
    };

    ranges.forEach(function(language) {
      var stats = botsVsWikipedians[language];
      updateStats(language, stats.bots, stats.wikipedians);
      globalBots += stats.bots;
      globalWikipedians += stats.wikipedians;
    });
    if (!considerWikidata.checked) {
      globalBots -= botsVsWikipedians['wikidata'].bots;
      globalWikipedians -= botsVsWikipedians['wikidata'].wikipedians;
    }
    updateStats('global', globalBots, globalWikipedians);
  }, 500);

  contentDiv.appendChild(createStatsPane('global', 0, 0));

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
      contentDiv.appendChild(createStatsPane(
          data.language, stats.bots, stats.wikipedians));
    }
    if (data.isBot) {
      botsVsWikipedians[data.language].bots += 1;
    } else {
      botsVsWikipedians[data.language].wikipedians += 1;
    }
  }, false);

})();
