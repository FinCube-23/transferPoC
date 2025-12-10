/**
 * RabbitMQ ClientProxy Adapter
 *
 * Provides a NestJS ClientProxy-like interface for use with @mskits/validate-auth
 * This adapter wraps amqplib sendAndReceive to behave like NestJS's ClientProxy.send()
 */

const { Observable } = require("rxjs");
const { sendAndReceive, initializePublisher, isPublisherConnected } = require("./rabbitmq-publisher");
const { Logger } = require("./logger");

const logger = new Logger("RabbitMQ-ClientProxy");

/**
 * ClientProxy adapter class
 * Implements the minimal interface required by @mskits/validate-auth
 */
class RabbitMQClientProxy {
    constructor() {
        this.initialized = false;
    }

    /**
     * Initialize the underlying RabbitMQ connection
     * @returns {Promise<void>}
     */
    async initialize() {
        if (!this.initialized) {
            await initializePublisher();
            this.initialized = true;
        }
    }

    /**
     * Send a message pattern and return an Observable (NestJS ClientProxy interface)
     * @param {string} pattern - Message pattern (e.g., "validate-authorization")
     * @param {object} data - Data to send
     * @returns {Observable} RxJS Observable that emits the response
     */
    send(pattern, data) {
        return new Observable((subscriber) => {
            const timeout = parseInt(process.env.AUTH_SERVICE_TIMEOUT) || 5000;

            // Ensure connection is ready before sending
            const execute = async () => {
                try {
                    if (!isPublisherConnected()) {
                        await initializePublisher();
                    }

                    logger.debug("Sending RPC request via ClientProxy adapter", {
                        pattern,
                        hasData: !!data,
                    });

                    // Wrap data in 'data' object for UMS compatibility
                    // UMS expects: { data: { access_token: "...", options: {} } }
                    // @mskits/validate-auth sends: { access_token: "...", options: {} }
                    const wrappedData = pattern === "validate-authorization" 
                        ? { data: data }
                        : data;

                    const response = await sendAndReceive(pattern, wrappedData, timeout);
                    subscriber.next(response);
                    subscriber.complete();
                } catch (error) {
                    logger.error("ClientProxy send error", {
                        pattern,
                        error: error.message,
                    });
                    subscriber.error(error);
                }
            };

            execute();
        });
    }

    /**
     * Emit a message pattern (fire-and-forget)
     * Not used by validate-auth but included for interface completeness
     * @param {string} pattern - Message pattern
     * @param {object} data - Data to send
     * @returns {Observable} RxJS Observable that completes after emit
     */
    emit(pattern, data) {
        return new Observable((subscriber) => {
            logger.warn("emit() called on RabbitMQ ClientProxy adapter - not fully implemented");
            subscriber.next(null);
            subscriber.complete();
        });
    }
}

// Singleton instance for USER_MANAGEMENT_SERVICE
let umsClientProxy = null;

/**
 * Get the User Management Service RabbitMQ client proxy
 * @returns {RabbitMQClientProxy}
 */
function getUMSRabbitClient() {
    if (!umsClientProxy) {
        umsClientProxy = new RabbitMQClientProxy();
    }
    return umsClientProxy;
}

/**
 * Initialize the UMS RabbitMQ client proxy
 * @returns {Promise<RabbitMQClientProxy>}
 */
async function initializeUMSRabbitClient() {
    const client = getUMSRabbitClient();
    await client.initialize();
    return client;
}

module.exports = {
    RabbitMQClientProxy,
    getUMSRabbitClient,
    initializeUMSRabbitClient,
};
