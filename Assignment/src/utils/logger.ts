import winston from 'winston'
const {combine,timestamp,printf,cli} = winston.format

export const logger = winston.createLogger({
    level: 'info',
    format: combine(
        timestamp(),
        cli(),
        printf( (info) => `${info.timestamp} ${info.level} : ${info.message}` )
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({
            filename: 'logs/error.log',
            level: 'error',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
        }),
    ],
});

//logger for big tranasctions
export const transactionLogger = winston.createLogger({
    level: 'info',
    format: combine(
        timestamp(),
        cli(),
        printf( (info) => `${info.timestamp} ${info.level} : ${info.message}` )
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({
            filename: 'logs/transactions.log',
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
        }),
    ],
});



