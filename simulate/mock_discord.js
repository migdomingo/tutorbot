/**
 * Mock Discord objects for local simulation.
 * Replicates the Message/Channel interface used by the bot handlers.
 *
 * Discord.js returns Collections (Map subclass with .filter() and .map()),
 * not plain Maps. FakeCollection replicates that interface.
 */

class FakeCollection extends Map {
  filter(fn) {
    const result = new FakeCollection();
    for (const [key, value] of this) {
      if (fn(value, key, this)) result.set(key, value);
    }
    return result;
  }

  map(fn) {
    const result = [];
    for (const [key, value] of this) {
      result.push(fn(value, key, this));
    }
    return result;
  }
}

class FakeChannel {
  constructor(channelId) {
    this.id = channelId;
    this._history = [];
    this.messages = {
      cache: new FakeCollection(),
      fetch: async ({ limit = 30 } = {}) => {
        const slice = this._history.slice(-limit);
        const col = new FakeCollection(slice.map(m => [m.id, m]));
        return col;
      }
    };
  }

  addMessage(msg) {
    this._history.push(msg);
    this.messages.cache.set(msg.id, msg);
  }

  async send(content) {
    const text = typeof content === 'string' ? content : content.content;
    console.log(`\n🤖 ${text}\n`);
    const msg = {
      id: `bot-${Date.now()}`,
      content: text,
      author: { id: 'bot', username: 'Facilitador', bot: true }
    };
    this._history.push(msg);
    this.messages.cache.set(msg.id, msg);
    return msg;
  }
}

function createFakeMessage(author, content, channel) {
  const msg = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    channelId: channel.id,
    content,
    author: { id: author.id, username: author.username, bot: false },
    channel,
    reply: async (text) => {
      const out = typeof text === 'string' ? text : text.content;
      console.log(`\n🤖 ${out}\n`);
      const botMsg = {
        id: `bot-${Date.now()}`,
        content: out,
        author: { id: 'bot', username: 'Facilitador', bot: true }
      };
      channel.addMessage(botMsg);
      return botMsg;
    }
  };
  channel.addMessage(msg);
  return msg;
}

module.exports = { FakeCollection, FakeChannel, createFakeMessage };
