import express = require('express');
import type { Request, Response } from 'express';
import cors = require('cors');
import dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

app.get('/api/v1/health', (req: Request, res: Response) => {
    res.status(200).json({ status: 'UP', service: 'DeskOps Ticketing Core' });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});