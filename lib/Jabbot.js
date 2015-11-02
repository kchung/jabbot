'use strict';

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var _slicedToArray = (function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; })();

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _slackbots = require('slackbots');

var _slackbots2 = _interopRequireDefault(_slackbots);

var _superagent = require('superagent');

var _superagent2 = _interopRequireDefault(_superagent);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var Jabbot = (function (_Slackbots) {
  _inherits(Jabbot, _Slackbots);

  /**
   * @constructor
   * @param {Object} params Jabbot options
   * @param {String} params.name Jabbot name
   * @param {String} params.token Slack token
   * @param {String} params.api Jabwire API key
   */

  function Jabbot() {
    _classCallCheck(this, Jabbot);

    var params = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

    var _this4 = _possibleConstructorReturn(this, Object.getPrototypeOf(Jabbot).call(this, params));

    _this4.api = params.api;
    return _this4;
  }

  /**
   * Run Jabbot, listen to events
   */

  _createClass(Jabbot, [{
    key: 'run',
    value: function run() {
      this.on('start', this.onStart.bind(this));
      this.on('message', this.onMessage.bind(this));
    }

    /**
     * Start event handler
     * @param {Object} event
     */

  }, {
    key: 'onStart',
    value: function onStart() {
      this.user = this.findUserByName(this.name);
      console.log('Jabbot ready');
    }

    /**
     * Message event handler
     * @param {Object} event
     */

  }, {
    key: 'onMessage',
    value: function onMessage(event) {
      var _this = this;

      if (this.isValidEvent(event)) {
        (function () {
          var text = event.text;
          var channel = event.channel;

          var message = text.toLowerCase();

          // Match for multiple tickets before breaking down
          var global = new RegExp(_this.mention, 'g');
          var local = new RegExp(_this.mention);

          // Match multiple occurances
          message.match(global).forEach(function (partial) {
            var _partial$match = partial.match(local);

            var _partial$match2 = _slicedToArray(_partial$match, 4);

            var noop = _partial$match2[0];
            var project = _partial$match2[1];
            var type = _partial$match2[2];
            var id = _partial$match2[3];

            _this.sendTicket(channel, project, type, id);
          });
        })();
      }
    }

    /**
     * Get the Jabwire ticket
     * @param {String} project
     * @param {String} type
     * @param {String} id
     * @return {Promise}
     */

  }, {
    key: 'getTicket',
    value: function getTicket(project, type, id) {
      var _this2 = this;

      return new Promise(function (resolve, reject) {
        var url = _this2.buildUrl(project, type, id);

        _superagent2.default.get(url + '.json').query({
          apikey: _this2.api
        }).end(function (error, response) {
          if (error) {
            reject(error);
          } else if (response.statusCode === 200) {
            resolve(response.body);
          } else {
            reject(response);
          }
        });
      });
    }

    /**
     * Send ticket to channel supplied channel
     * @param {String} channel
     * @param {String} project
     * @param {String} type
     * @param {String} id
     * @return {Promise}
     */

  }, {
    key: 'sendTicket',
    value: function sendTicket(channel, project, type, id) {
      var _this3 = this;

      return this.getTicket(project, type, id).then(function (ticket) {
        var _findChannelById = _this3.findChannelById(channel);

        var name = _findChannelById.name;

        var params = {
          'icon_url': 'http://imgur.com/UeMdM9p.png',
          'attachments': _this3.buildTicketAttachments(ticket, project, type, id)
        };

        return _this3.postMessageToChannel(name, '', params);
      }).catch(function (error) {
        console.error(error);
      });
    }

    /**
     * Build a message attachment
     * @param {Object} ticket
     * @param {String} project
     * @param {String} type
     * @param {String} id
     * @return {String} JSON stringified attachment
     */

  }, {
    key: 'buildTicketAttachments',
    value: function buildTicketAttachments(ticket, project, type, id) {
      var url = this.buildUrl(project, type, id);
      var title = this.formatTitle(type);
      var attachment = {
        'fallback': 'Jabwire: ' + title + ' #' + id + ' - ' + url,

        'color': '#658CB2',
        'title': ticket.title,
        'title_link': url,

        'author_name': 'Jabwire: ' + title + ' #' + id,
        'author_link': url,

        'mrkdwn_in': ['text']
      };

      switch (type) {
        case 'sprint_tasks':
          attachment.text = this.buildSprintTicket(ticket);
          break;
        case 'bugs':
          attachment.text = this.buildBugTicket(ticket);
          break;
      }

      return JSON.stringify([attachment]);
    }

    /**
     * Build a bug task specific message
     * @param {Object} ticket
     * @return {String} Bug specific attachment message
     */

  }, {
    key: 'buildBugTicket',
    value: function buildBugTicket(ticket) {
      var priority = ticket.priority;
      var workflow = ticket.workflow;
      var resolution = ticket.resolution;
      var activities = ticket.activities;

      var external = activities.filter(function (activity) {
        return activity.external_ref !== null;
      });

      var message = ['_Priority_: ' + priority, '_Workflow_: ' + workflow, '_Resolution_: ' + resolution, '_External Activity_: ' + external.length];

      return message.join(' | ');
    }

    /**
     * Build a sprint task specific message
     * @param {Object} ticket
     * @return {String} Sprint task specific attachment message
     */

  }, {
    key: 'buildSprintTicket',
    value: function buildSprintTicket(ticket) {
      var workflow = ticket.workflow;
      var estimate = ticket.estimate;
      var updated_at = ticket.updated_at;

      var _updated_at$match = updated_at.match(/(\d{4})-(\d{2})-(\d{2})/);

      var _updated_at$match2 = _slicedToArray(_updated_at$match, 4);

      var noop = _updated_at$match2[0];
      var year = _updated_at$match2[1];
      var month = _updated_at$match2[2];
      var day = _updated_at$match2[3];

      var message = ['_Workflow_: ' + workflow, '_Updated_: ' + month + '/' + day + '/' + year, '_Estimate_: ' + estimate];

      return message.join(' | ');
    }

    /**
     * Check if event is a valid message to respond to
     * @param {Object} event
     * @return {Boolean} Event is valid to respond to
     */

  }, {
    key: 'isValidEvent',
    value: function isValidEvent(event) {
      return this.isChatMessage(event) && this.isChannelConversation(event) && !this.isFromSelf(event) && this.isJabwireMention(event);
    }

    /**
     * Check if event is a valid chat message
     * @param {Object} event
     * @return {Boolean} If event is a valid message
     */

  }, {
    key: 'isChatMessage',
    value: function isChatMessage(event) {
      return event.type === 'message' && !!event.text;
    }

    /**
     * Check if event is a channel conversation
     * @param {Object} event
     * @return {Boolean} If event is a channel conversation
     */

  }, {
    key: 'isChannelConversation',
    value: function isChannelConversation(event) {
      return typeof event.channel === 'string' && event.channel[0] === 'C';
    }

    /**
     * Check if event is posted by the bot itself
     * @param {Object} event
     * @return {Boolean} If event is posted by itself
     */

  }, {
    key: 'isFromSelf',
    value: function isFromSelf(event) {
      return event.user === this.user.id;
    }

    /**
     * Check if the event message is a Jabwire message
     * @param {Object} event
     * @return {Boolean} If event is probably a Jabwire message
     */

  }, {
    key: 'isJabwireMention',
    value: function isJabwireMention(event) {
      return event.text.toLowerCase().match(this.mention);
    }

    /**
     * Find user by name
     * @param {String} name
     * @return {Object}
     */

  }, {
    key: 'findUserByName',
    value: function findUserByName(name) {
      return this.users.filter(function (user) {
        return user.name === name;
      })[0];
    }

    /**
     * Find channel by id
     * @param {String} id
     * @return {Object}
     */

  }, {
    key: 'findChannelById',
    value: function findChannelById(id) {
      return this.channels.filter(function (channel) {
        return channel.id === id;
      })[0];
    }

    /**
     * 
     * @param {String} project
     * @param {String} type
     * @param {String} id
     * @return {String}
     */

  }, {
    key: 'buildUrl',
    value: function buildUrl(project, type, id) {
      return this.jabwire.replace('{project}', project).replace('{type}', type).replace('{id}', id);
    }

    /**
     * Format Jabwire type
     * @param {String} type
     * @return {String} 
     */

  }, {
    key: 'formatTitle',
    value: function formatTitle(type) {
      return this.types[type];
    }
  }]);

  return Jabbot;
})(_slackbots2.default);

exports.default = Jabbot;
;

/**
 * @property {RegExp} Regex to detect if a Jabwire link is posted
 */
Jabbot.prototype.mention = 'jabwire.com/projects/(.*?)/(bugs|sprint_tasks)/(\\d+)';

/**
 * @property {String} Jabwire URL schema
 */
Jabbot.prototype.jabwire = 'https://www.jabwire.com/projects/{project}/{type}/{id}';

/**
 * @property {Object} Simple dictionary of raw types with human readable
 *   values
 */
Jabbot.prototype.types = {
  'sprint_tasks': 'Sprint Task',
  'bugs': 'Bug'
};
