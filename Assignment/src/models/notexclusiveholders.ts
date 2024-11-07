import mongoose, { Document, Model, Schema } from 'mongoose';

interface INotExclusiveHolder extends Document {
    walletAddress: string;
    tokenAddress: string;
}

const notExclusiveHolderSchema: Schema<INotExclusiveHolder> = new mongoose.Schema({
    walletAddress: {
        type: String,
        unique: true,
        required: true
    },
    tokenAddress: {
        type: String,
        required: true
    },
});

const NotExclusiveHolders: Model<INotExclusiveHolder> = mongoose.model<INotExclusiveHolder>('notexclusiveholders', notExclusiveHolderSchema);

export default NotExclusiveHolders;
