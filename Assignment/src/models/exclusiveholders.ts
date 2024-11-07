import mongoose, { Document, Model, Schema } from 'mongoose';

interface IExclusiveHolder extends Document {
    walletAddress: string;
    tokenAddress: string;
    solBalance: number;
    tokenBalance: number;
    openTrade: boolean
}

const exclusiveHolderSchema: Schema<IExclusiveHolder> = new mongoose.Schema({
    walletAddress: {
        type: String,
        unique: true,
        required: true
    },
    tokenAddress: {
        type: String,
        required: true
    },
    solBalance: {
        type: Number,
        required: true
    },
    tokenBalance: {
        type: Number,
        required: true
    },
    openTrade: {
        type: Boolean,
        required: true
    }
});

const ExclusiveHolders: Model<IExclusiveHolder> = mongoose.model<IExclusiveHolder>('exclusiveholders', exclusiveHolderSchema);

export default ExclusiveHolders;
