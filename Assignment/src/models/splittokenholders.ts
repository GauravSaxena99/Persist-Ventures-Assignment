import mongoose, { Document, Model, Schema } from 'mongoose';

interface ISplitTokenHolder extends Document {
    walletAddress: string;
    tokenAddress: string;
    tokenTransferred: number;
    signature: string;
}

const splitTokenHolderSchema: Schema<ISplitTokenHolder> = new mongoose.Schema({
    walletAddress: {
        type: String,
        unique: true,
        required: true
    },
    tokenAddress: {
        type: String,
        required: true
    },
    tokenTransferred: {
        type: Number,
        required: true
    },
    signature: {
        type: String,
        required: true
    }
});

const SplitTokenHolders: Model<ISplitTokenHolder> = mongoose.model<ISplitTokenHolder>('splittokenholders', splitTokenHolderSchema);

export default SplitTokenHolders;