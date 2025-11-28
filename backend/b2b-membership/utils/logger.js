/**
 * Structured Logging Utility
 *
 * Provides structured logging with timestamps, log levels, and context
 * for the ZKP Proof Controller system.
 */

const LOG_LEVELS = {
    DEBUG: "DEBUG",
    INFO: "INFO",
    WARN: "WARN",
    ERROR: "ERROR",
}

class Logger {
    constructor(context = "ZKP-Controller") {
        this.context = context
        this.enableDebug =
            process.env.LOG_LEVEL === "DEBUG" ||
            process.env.NODE_ENV === "development"
    }

    /**
     * Format timestamp in ISO format
     * @returns {string} Formatted timestamp
     */
    getTimestamp() {
        return new Date().toISOString()
    }

    /**
     * Format log message with timestamp, level, and context
     * @param {string} level - Log level
     * @param {string} message - Log message
     * @param {object} metadata - Additional metadata
     * @returns {string} Formatted log message
     */
    formatMessage(level, message, metadata = {}) {
        const timestamp = this.getTimestamp()
        const baseLog = `[${timestamp}] [${level}] [${this.context}] ${message}`

        if (Object.keys(metadata).length > 0) {
            return `${baseLog}\n${JSON.stringify(metadata, null, 2)}`
        }

        return baseLog
    }

    /**
     * Log debug message
     * @param {string} message - Debug message
     * @param {object} metadata - Additional metadata
     */
    debug(message, metadata = {}) {
        if (this.enableDebug) {
            console.log(this.formatMessage(LOG_LEVELS.DEBUG, message, metadata))
        }
    }

    /**
     * Log info message
     * @param {string} message - Info message
     * @param {object} metadata - Additional metadata
     */
    info(message, metadata = {}) {
        console.log(this.formatMessage(LOG_LEVELS.INFO, message, metadata))
    }

    /**
     * Log warning message
     * @param {string} message - Warning message
     * @param {object} metadata - Additional metadata
     */
    warn(message, metadata = {}) {
        console.warn(this.formatMessage(LOG_LEVELS.WARN, message, metadata))
    }

    /**
     * Log error message
     * @param {string} message - Error message
     * @param {object} metadata - Additional metadata (error details, stack traces, etc.)
     */
    error(message, metadata = {}) {
        console.error(this.formatMessage(LOG_LEVELS.ERROR, message, metadata))
    }

    /**
     * Log workflow step start
     * @param {string} stepName - Name of the workflow step
     * @param {string} description - Description of the step
     */
    stepStart(stepName, description) {
        this.info(`Step started: ${stepName}`, { description })
    }

    /**
     * Log workflow step completion
     * @param {string} stepName - Name of the workflow step
     * @param {number} duration - Duration in milliseconds
     * @param {object} details - Additional details about the step
     */
    stepComplete(stepName, duration, details = {}) {
        this.info(`Step completed: ${stepName}`, {
            duration: `${(duration / 1000).toFixed(2)}s`,
            ...details,
        })
    }

    /**
     * Log workflow step failure
     * @param {string} stepName - Name of the workflow step
     * @param {Error|object} error - Error object or error details
     * @param {object} context - Additional context (stdout, stderr, file contents, etc.)
     */
    stepError(stepName, error, context = {}) {
        const errorDetails = {
            step: stepName,
            error: error.message || error,
            ...(error.stack && { stack: error.stack }),
            ...context,
        }

        this.error(`Step failed: ${stepName}`, errorDetails)
    }

    /**
     * Log command execution
     * @param {string} command - Command being executed
     * @param {string} cwd - Working directory
     */
    commandStart(command, cwd) {
        this.debug(`Executing command: ${command}`, { cwd })
    }

    /**
     * Log command completion
     * @param {string} command - Command that was executed
     * @param {number} exitCode - Exit code
     * @param {string} stdout - Standard output
     * @param {string} stderr - Standard error
     */
    commandComplete(command, exitCode, stdout, stderr) {
        if (exitCode === 0) {
            this.debug(`Command completed: ${command}`, {
                exitCode,
                ...(stdout && { stdout }),
                ...(stderr && { stderr }),
            })
        } else {
            this.error(`Command failed: ${command}`, {
                exitCode,
                stdout,
                stderr,
            })
        }
    }

    /**
     * Log directory listing
     * @param {string} directory - Directory path
     * @param {string[]} files - List of files
     */
    directoryListing(directory, files) {
        this.debug(`Directory listing: ${directory}`, { files })
    }

    /**
     * Log file contents
     * @param {string} filePath - Path to the file
     * @param {string} contents - File contents
     */
    fileContents(filePath, contents) {
        this.debug(`File contents: ${filePath}`, { contents })
    }

    /**
     * Log workflow summary
     * @param {object} stepResults - Results of each workflow step
     * @param {number} totalDuration - Total workflow duration in milliseconds
     */
    workflowSummary(stepResults, totalDuration) {
        const summary = {
            totalDuration: `${(totalDuration / 1000).toFixed(2)}s`,
            steps: {},
        }

        Object.entries(stepResults).forEach(([stepKey, result]) => {
            summary.steps[stepKey] = {
                status: result.status,
                ...(result.duration && {
                    duration: `${(result.duration / 1000).toFixed(2)}s`,
                }),
                ...(result.error && {
                    error: result.error.message || result.error,
                }),
            }
        })

        this.info("Workflow summary", summary)
    }

    /**
     * Create a child logger with additional context
     * @param {string} additionalContext - Additional context to append
     * @returns {Logger} New logger instance with combined context
     */
    child(additionalContext) {
        return new Logger(`${this.context}:${additionalContext}`)
    }
}

module.exports = { Logger, LOG_LEVELS }
