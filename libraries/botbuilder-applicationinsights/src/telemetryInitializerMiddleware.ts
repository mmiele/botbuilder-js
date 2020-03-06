// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License

import { TelemetryLoggerMiddleware } from '@chrimc62/botbuilder-core';
import { Middleware } from '@chrimc62/botbuilder-core';
import { TurnContext } from '@chrimc62/botbuilder-core';
import { CorrelationContext } from 'applicationinsights/out/AutoCollection/CorrelationContextManager';
import * as appInsights from 'applicationinsights';

/**
 * Middleware for storing the incoming activity to be made available to Application Insights and optionally run the TelemetryLoggerMiddleware.
 * Uses the botTelemetryClient interface.
 */
export class TelemetryInitializerMiddleware implements Middleware {

    // tslint:disable:variable-name
    private readonly _logActivityTelemetry: boolean;
    private readonly _telemetryLoggerMiddleware: TelemetryLoggerMiddleware;
    private _correlationContext: CorrelationContext;
    // tslint:enable:variable-name

    /**
     * Initializes a new instance of the TelemetryInitializerMiddleware class.
     * @param telemetryLoggerMiddleware The TelemetryLoggerMiddleware used for logging activity telemetry.
     * * @param logActivityTelemetry (Optional) Enable/Disable logging of activity telemetry.
     */
    constructor(telemetryLoggerMiddleware: TelemetryLoggerMiddleware, logActivityTelemetry: boolean = false) {
        this._telemetryLoggerMiddleware = telemetryLoggerMiddleware;
        this._logActivityTelemetry = logActivityTelemetry;
    }

    /**
     * Gets a value indicating whether determines whether to call the telemetry logging middleware to log activity events.
     */
    public get logActivityTelemetry(): boolean { return this._logActivityTelemetry; }

    /**
     * Gets the currently configured TelemetryLoggerMiddleware that logs activity events.
     */
    public get telemetryClient(): TelemetryLoggerMiddleware { return this._telemetryLoggerMiddleware; }

    /**
     * Sets the correlation context so that a mock context can be passed in for testing purposes.
     */
    protected set appInsightsCorrelationContext(value: CorrelationContext) { this._correlationContext = value; }

    /**
     * Gets the correlation context that can be used for testing purposes.
     */
    protected get appInsightsCorrelationContext() { return this._correlationContext; }

    /**
     * Store the incoming activity on the App Insights Correlation Context and optionally calls the TelemetryLoggerMiddleware
     * @param context The context object for this turn.
     * @param next The delegate to call to continue the bot middleware pipeline
     */
    public async onTurn(context: TurnContext, next: () => Promise<void>): Promise<void> {
        if (context === null) {
            throw new Error('context is null');
        }

        if (context.activity && context.activity.id) {
            const correlationContext: CorrelationContext = this._correlationContext || appInsights.getCorrelationContext();
            if(correlationContext)
            {
                correlationContext['activity'] = context.activity;
            }
        }

        if(this._logActivityTelemetry && this._telemetryLoggerMiddleware)
        {
            await this._telemetryLoggerMiddleware.onTurn(context, next);
        }
        else if (next !== null) {
            await next();
        }
    }
}