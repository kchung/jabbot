import Slack from 'slack-client';
import request from 'superagent';
import Promise from 'bluebird';

export default class Jabbot extends Slack {

  /**
   * @property {String} Regex to detect if a Jabwire link is posted
   */
  mention = 'jabwire.com/projects/(.*?)/(bugs|sprint_tasks)/(\\d+)'

  /**
   * @property {String} Regex to detect if a Jabwire short hand is posted
   *   like "Bug #1234" and "Sprint Task #12312"
   */
  shorthand = '\\b(bug|sprint(?:\\s+)?task|task)(?:\\s+)?(?:#)?(\\d+)\\b';

  /**
   * @property {String} Jabwire URL schema
   */
  jabwire = 'https://www.jabwire.com/projects/{project}/{type}/{id}'

  /**
   * @property {Object} Simple dictionary of raw types with human readable
   *   values
   */
  types = {
    'sprint_tasks': 'Sprint Task',
    'bugs': 'Bug'
  }

  /**
   * @constructor
   * @param {Object} params Jabbot options
   * @param {String} params.name Jabbot name
   * @param {String} params.token Slack token
   * @param {String} params.api Jabwire API key
   * @param {String} params.api Jabwire project id
   */
  constructor(params = {}) {
    // Default `autoReconnect` and `autoMark` to `true`
    super(params.token, true, true);

    if (!params.api) {
      throw new Error('Jabwire API token required');
    }
    else if (!params.project) {
      throw new Error('Jabwire project id required');
    }

    this.api = params.api;
    this.project = params.project;

    // Listen to all incoming messages
    this.on('message', this.checkMessage.bind(this));

    this.login();
  }

  /**
   * Message event handler
   * @param {Object} event
   */
  checkMessage(event) {
    if (this.isValidMessage(event)) {
      const {text, channel} = event;
      const message = text.toLowerCase();

      // Match for multiple tickets before breaking down
      const global = new RegExp(this.mention, 'g');
      const local = new RegExp(this.mention);

      // Match multiple occurances
      this.getMatches(message).forEach((partial) => {
        const {project, type, id} = this.getTicketMatches(partial);
        this.sendTicket(channel, project, type, id)
          .then((message) => {
            this.emit('send', message);
          })
          .catch((e) => {
            this.emit('failed', message);
          });
      });
    }
  }

  /**
   * Attempt to match message with either a url mention or a text mention
   * @param {String} message
   * @return {Array} Any possible matches
   */
  getMatches(message) {
    return message.match(new RegExp(this.mention, 'ig'))
      || message.match(new RegExp(this.shorthand, 'ig'));
  }

  /**
   * Attempt Jabwire ticket data out of the message, it can either be a
   * url or from a string (e.g Bug 1234)
   * @param {String} message
   * @return {Object}
   */
  getTicketMatches(message) {
    return this.getMatchesFromUrl(message)
      || this.getMatchesFromString(message);
  }

  /**
   * Attempt to pull the ticket info as a URL from message
   * @param {String} [message = '']
   * @return {Object|Undefined}
   */
  getMatchesFromUrl(message = '') {
    const [match, project, type, id] = message.match(new RegExp(this.mention)) || [];

    if (match) {
      return {
        project,
        type,
        id
      }
    }

    return match;
  }

  /**
   * Attempt to pull the ticket info as a string from message
   * @param {String} [message = '']
   * @return {Object|Null}
   */
  getMatchesFromString(message = '') {
    const [match, type, id] = message.match(new RegExp(this.shorthand, 'i')) || [];

    if (match) {
      return {
        project: this.project,
        type: /bug/i.test(type) ? 'bugs' : 'sprint_tasks',
        id: id
      }
    }

    return match;
  }

  /**
   * Get the Jabwire ticket
   * @param {String} project
   * @param {String} type
   * @param {String} id
   * @return {Promise}
   */
  getTicket(project, type, id) {
    return new Promise((resolve, reject) => {
      const url = this.buildUrl(project, type, id);

      request.get(url + '.json')
        .query({
          apikey: this.api
        })
        .end((error, response) => {
          if (error) {
            reject(error);
          }
          else if (response.statusCode === 200) {
            resolve(response.body);
          }
          else {
            reject(response);
          }
        });
    });
  }

  /**
   * Send ticket to channel supplied channel
   * @param {String} channel Slack medium (group or channel)
   * @param {String} project Jabwire project id
   * @param {String} type Ticket type (`bugs` or `sprint_tasks`)
   * @param {String} id Ticket id
   * @return {Promise}
   */
  sendTicket(channel, project, type, id) {
    return this.getTicket(project, type, id)
      .then((ticket) => {
        const params = {
          'icon_url': 'http://imgur.com/UeMdM9p.png',
          'attachments': this.buildTicketAttachments(ticket, project, type, id)
        };

        return this.postToChannel(channel, '', params)
          .then((response) => {
            return {
              response: response,
              ticket: {
                ...ticket,
                type: type,
                project: project
              },
              params: {
                ...params,
                attachments: JSON.parse(params.attachments)
              }
            }
          });
      });
  }

  /**
   * Post message to the channel
   * @param {String} channel The channel, group, or DM
   * @param {String} text Message to send
   * @param {Object} params Additional message parameters
   * @return {Promise.<String, Error>} Returns API response
   */
  postToChannel(channel, text, params = {}) {
    return new Promise((resolve, reject) => {
      const message = {
        username: this.name,
        channel: channel,
        text: text,
        ...params
      };

      this._apiCall('chat.postMessage', message, (response) => {
        if (response.ok) {
          resolve(response);
        } else {
          reject(response);
        }
      });
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
  buildTicketAttachments(ticket, project, type, id) {
    const url = this.buildUrl(project, type, id);
    const title = this.formatTitle(type);
    const attachment = {
      'fallback': `Jabwire: ${title} #${id} - ${url}`,

      'color': '#658CB2',
      'title': ticket.title,
      'title_link': url,

      'author_name': `Jabwire: ${title} #${id}`,
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
  buildBugTicket(ticket) {
    const {priority, workflow, resolution, activities} = ticket;

    const external = activities.filter((activity) => {
      return activity.message_type === 'external_reference';
    });

    const message = [
      `_Priority_: ${capitalize(priority)}`,
      `_Workflow_: ${capitalize(workflow)}`,
      `_Resolution_: ${capitalize(resolution)}`,
      `_Ticket References_: ${external.length}`
    ];

    return message.join(' | ');
  }

  /**
   * Build a sprint task specific message
   * @param {Object} ticket
   * @return {String} Sprint task specific attachment message
   */
  buildSprintTicket(ticket) {
    const {workflow, estimate, updated_at} = ticket;
    const [noop, year, month, day] = updated_at.match(/(\d{4})-(\d{2})-(\d{2})/);

    const message = [
      `_Workflow_: ${capitalize(workflow)}`,
      `_Updated_: ${month}/${day}/${year}`,
      `_Estimate_: ${estimate}`
    ];

    return message.join(' | ');
  }

  /**
   * Check if event is a valid message to respond to
   * @param {Object} event
   * @return {Boolean} Event is valid to respond to
   */
  isValidMessage(event) {
    return !this.isFromSelf(event)
      && this.isJabwireMention(event);
  }

  /**
   * Check if event is posted by the bot itself
   * @param {Object} event
   * @return {Boolean} If event is posted by itself
   */
  isFromSelf(event) {
    return event.user === this.self.id;
  }

  /**
   * Check if the event message is a Jabwire message
   * @param {Object} event
   * @return {Boolean} If event is probably a Jabwire message
   */
  isJabwireMention(event) {
    const text = event.text || '';
    return text.toLowerCase().match(new RegExp(this.mention))
      || text.match(new RegExp(this.shorthand, 'i'));
  }

  /**
   * Build Jabwire URL
   * @param {String} project Jabwire project
   * @param {String} type Jabwire ticket type (sprint_task or bug)
   * @param {String} id Jabwire ticket id
   * @return {String} Build Jabwire URL
   */
  buildUrl(project, type, id) {
    return this.jabwire
      .replace('{project}', project)
      .replace('{type}', type)
      .replace('{id}', id);
  }

  /**
   * Format Jabwire type
   * @param {String} type
   * @return {String} 
   */
  formatTitle(type) {
    return this.types[type];
  }

}

/**
 * Capitalize and format string
 * @return {String} String that is capitalized and without underscore
 */
function capitalize(string = '') {
  return string.split('_').map((partial) => {
    return partial.charAt(0).toUpperCase() + partial.slice(1)
  }).join(' ');
}
