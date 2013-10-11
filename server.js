var request = require('request');
var cheerio = require('cheerio');
var irc = require('irc');
var async = require('async');
var express = require('express');
var http = require('http');
var app = express();
var server = http.createServer(app);

var LIST_OF_WIKIPEDIAS_URL = 'https://meta.wikimedia.org/wiki/List_of_Wikipedias';

var IRC_SERVER = 'irc.wikimedia.org';
var IRC_NICK = 'Wikipedia-Edits-SSE';
var IRC_REAL_NAME_AND_CONTACT = 'Thomas Steiner (tomac@google.com)';

var DISCARD_WIKIPEDIA_BOTS = true;

var addIrcErrorListener = function(callback) {
  client.addListener('error', function(message) {
    console.warn('IRC error: ' + message);
  });
  callback(null);
};

var addIrcRegisteredListener = function(callback) {
  client.addListener('registered', function(message) {
    console.log('Connected to IRC server ' + IRC_SERVER);
    // connect to IRC channels
  });
  callback(null);
}

var joinChannels = function(wikipedias) {
  wikipedias.forEach(function(channel, i) {
    channel = '#' + channel + '.wikipedia';
    console.log((++i) + ') Joining channel ' + channel);
    client.join(channel);
  });
};

var getListOfWikipedias = function(callback) {
  request.get(LIST_OF_WIKIPEDIAS_URL, function(error, response, body) {
    if (error || response.statusCode !== 200) {
      callback('List of Wikipedias could not be loaded: ' + error);
    }
    var $ = cheerio.load(body);
    callback(null, $('td > a[class="extiw"][title$=":"]').map(function(i, el) {
      return el.attribs.title.replace(/:$/, '');
    }));
  });
};

var addIrcJoinedListener = function(callback) {
  client.addListener('join', function(channel, nick, message) {
    if (nick === IRC_NICK) {
      console.log(nick + ' joined channel ' + channel);
    }
  });
  callback(null);
};

var parseMessage = function(message, to) {
  // get the editor's username or IP address
  // the IRC log format is as follows (with color codes removed):
  // rc-pmtpa: [[Juniata River]] \
  // http://en.wikipedia.org/w/index.php?diff=516269072&oldid=514659029 * \
  // Johanna-Hypatia * (+67) Category:Place names of Native American origin \
  // in Pennsylvania
  var messageComponents = message.split(' * ');
  var articleRegExp = /\[\[(.+?)\]\].+?$/;
  var article = messageComponents[0].replace(articleRegExp, '$1');
  // discard non-article namespaces, as listed here:
  // http://www.mediawiki.org/wiki/Help:Namespaces
  // this means only listening to messages without a ':' essentially
  if (article.indexOf(':') !== -1) {
    return false;
  }
  var editor = messageComponents[1];
  // discard edits made by bots.
  // bots are identified by a B flag, as documented here
  // http://www.mediawiki.org/wiki/Help:Tracking_changes
  // (the 'b' is actually uppercase in IRC)
  //
  // bots must identify themselves by prefixing or suffixing their
  // username with "bot".
  // http://en.wikipedia.org/wiki/Wikipedia:Bot_policy#Bot_accounts
  var flagsAndDiffUrl =
      messageComponents[0].replace('[[' + article + ']] ', '').split(' ');
  var flags = flagsAndDiffUrl[0];
  if (DISCARD_WIKIPEDIA_BOTS) {
    if ((/B/.test(flags)) ||
        (/\bbot/i.test(editor)) ||
        (/bot\b/i.test(editor))) {
      return;
    }
  }
  // normalize article titles to follow the Wikipedia URLs
  article = article.replace(/\s/g, '_');
  // the language format follows the IRC room format: "#language.project"
  var language = to.substring(1, to.indexOf('.'));
  editor = language + ':' + editor;
  // diff URL
  var diffUrl = flagsAndDiffUrl[1];
  if ((diffUrl.indexOf('diff') !== -1) &&
      (diffUrl.indexOf('oldid') !== -1)) {
    var toRev = diffUrl.replace(/.*\?diff=(\d+).*/, '$1');
    var fromRev = diffUrl.replace(/.*&oldid=(\d+).*/, '$1');
    if (language === 'wikidata') {
      diffUrl = 'http://wikidata.org/w/api.php?action=compare&torev=' +
          toRev + '&fromrev=' + fromRev + '&format=json';
    } else {
      diffUrl = 'http://' + language +
          '.wikipedia.org/w/api.php?action=compare&torev=' + toRev +
          '&fromrev=' + fromRev + '&format=json';
    }
  } else {
    diffUrl = '';
  }
  // delta
  deltaAndCommentRegExp = /\(([+-]\d+)\)\s(.*?)$/;
  var delta = messageComponents[2].replace(deltaAndCommentRegExp, '$1');
  // comment
  var comment = messageComponents[2].replace(deltaAndCommentRegExp, '$2');
  // language cluster URL
  var languageClusterUrl;
  if (language === 'wikidata') {
    languageClusterUrl = 'http://www.wikidata.org/w/api.php?' +
        'action=wbgetentities&props=sitelinks&format=json&ids=' + article;
  } else {
    languageClusterUrl = 'http://' + language +
        '.wikipedia.org/w/api.php?action=query&prop=langlinks' +
        '&format=json&lllimit=500&titles=' + article;
  }
  return {
    article: article,
    editor: editor,
    language: language,
    delta: delta,
    comment: comment,
    diffUrl: diffUrl,
    languageClusterUrl: languageClusterUrl
  };
};

var client = new irc.Client(
    IRC_SERVER,
    IRC_NICK,
    {
      userName: IRC_NICK,
      realName: IRC_REAL_NAME_AND_CONTACT,
      floodProtection: true,
      showErrors: true,
      stripColors: true
    });

addIrcRegisteredListener(function() {
  async.parallel({
    addIrcErrorListener: addIrcErrorListener,
    addIrcJoinedListener: addIrcJoinedListener,
    getListOfWikipedias: getListOfWikipedias,
  },
  function(err, results) {
    joinChannels(results.getListOfWikipedias);
  });
});

app.get('/', function(req, res) {

  var keepAlive = setInterval(function() {
    res.write(': Keep-Alive. Ignore.\n\n');
  }, 500);

  var addIrcMessageListener = function(callback) {
    client.addListener('message', function(from, to, message) {
      if (keepAlive) {
        clearInterval(keepAlive);
        keepAlive = null;
      }
      // this is the Wikipedia IRC bot that announces live changes
      if (from !== 'rc-pmtpa') {
        return;
      }
      var parsedMessage = parseMessage(message, to);
      if (!parsedMessage) {
        return;
      }
      emitMessage(parsedMessage);
    });
    callback && callback(null);
  };

  var emitMessage = function(message) {
    var messageString = JSON.stringify(message);
    res.write('data: ' + messageString + '\n\n');
    res.write('event: ' + message.language + 'edit\n');
    res.write('data: ' + messageString + '\n\n');
  };

  addIrcMessageListener(null);
  res.header({
    Connection: 'Keep-Alive',
    'Content-Type': 'text/event-stream'
  });
});

// start the server
var port = process.env.PORT || 8080;
console.log('Wikipedia-Edits-Server-Sent-Events listening on port ' + port + '.');
server.listen(port);