import mongoose, { Document, Model, Schema } from 'mongoose';
import { IOpenTrade } from '../types/types';
import { openTradeSchema } from './opentrades';

interface IFinishTrade extends Document {
    walletAddress: string;
    initialAmount: number;
    finalAmount: number;
    profitOrLoss: 'Profit' | 'Loss';
    openTrade: IOpenTrade;
    description: string;
}

const finishTradeSchema: Schema<IFinishTrade> = new mongoose.Schema({
    walletAddress: {
        type: String,
        required: true
    },
    initialAmount: {
        type: Number,
        required: true
    },
    finalAmount: {
        type: Number,
        required: true
    },
    profitOrLoss: {
        type: String,
        enum: ['Profit', 'Loss'],
        required: true
    },
    description: {
        type: String,
        required: true
    },
    openTrade: {
        type: openTradeSchema,
        required: true
    }
}, {
    timestamps: true  
});

const FinishTrades: Model<IFinishTrade> = mongoose.model<IFinishTrade>('finishtrades', finishTradeSchema);

export default FinishTrades;
