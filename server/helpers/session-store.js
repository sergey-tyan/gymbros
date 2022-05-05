/* redis-store.ts */
import dotenv from 'dotenv';
dotenv.config();
// Import the Node redis package
import { createClient } from 'redis';
import { Shopify } from '@shopify/shopify-api';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

class RedisStore {
  constructor() {
    // Create a new redis client and connect to the server
    this.client = createClient({
      url: redisUrl,
    });
    this.client.on('error', (err) => console.log('Redis Client Error', err));
    this.client.connect();
  }

  async saveAccessToken(shop, token) {
    try {
      return await this.client.set(`shopToken_${shop}`, token);
    } catch (err) {
      // throw errors, and handle them gracefully in your application
      throw new Error(err);
    }
  }

  async getAccessToken(shop) {
    try {
      return await this.client.get(`shopToken_${shop}`);
    } catch (err) {
      // throw errors, and handle them gracefully in your application
      throw new Error(err);
    }
  }

  // async mapAddressToCustomer(address, customerId) {
  //   try {
  //     return await this.client.set(`address_${address}`, customerId);
  //   } catch (err) {
  //     // throw errors, and handle them gracefully in your application
  //     throw new Error(err);
  //   }
  // }

  // async getCustomerByAddress(address) {
  //   try {
  //     return await this.client.get(`address_${address}`);
  //   } catch (err) {
  //     // throw errors, and handle them gracefully in your application
  //     throw new Error(err);
  //   }
  // }

  /*
    The storeCallback takes in the Session, and sets a stringified version of it on the redis store
    This callback is used for BOTH saving new Sessions and updating existing Sessions.
    If the session can be stored, return true
    Otherwise, return false
  */
  async storeCallback(session) {
    try {
      // Inside our try, we use the `setAsync` method to save our session.
      // This method returns a boolean (true if successful, false if not)
      return await this.client.set(session.id, JSON.stringify(session));
    } catch (err) {
      // throw errors, and handle them gracefully in your application
      throw new Error(err);
    }
  }

  /*
    The loadCallback takes in the id, and uses the getAsync method to access the session data
     If a stored session exists, it's parsed and returned
     Otherwise, return undefined
  */
  async loadCallback(id) {
    try {
      // Inside our try, we use `getAsync` to access the method by id
      // If we receive data back, we parse and return it
      // If not, we return `undefined`
      let reply = await this.client.get(id);
      if (reply) {
        const sessionObj = JSON.parse(reply);
        // See issue Shopify/shopify-node-api#333 for why we need to call cloneSession()
        // cloneSession will convert our javascript object into an instance of Session
        // cloneSession typically wants a Session object as input, but seems to also work
        // with just a plain javascript object
        return Shopify.Session.Session.cloneSession(sessionObj, sessionObj.id);
      } else {
        return undefined;
      }
    } catch (err) {
      throw new Error(err);
    }
  }

  /*
    The deleteCallback takes in the id, and uses the redis `del` method to delete it from the store
    If the session can be deleted, return true
    Otherwise, return false
  */
  async deleteCallback(id) {
    try {
      // Inside our try, we use the `delAsync` method to delete our session.
      // This method returns a boolean (true if successful, false if not)
      return await this.client.del(id);
    } catch (err) {
      throw new Error(err);
    }
  }
}

// Export the class
export default RedisStore;
