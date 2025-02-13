import express, { Request, Response } from 'express';

// Define an interface for the request body
interface AuthRequest {
    username: string;
    password: string;
}

const router = express.Router();

router.post(
    '/auth',
    (req: Request<Record<string, never>, { success: boolean }, AuthRequest>, res: Response) => {
        const { username, password } = req.body;

        if (username === 'admin' && password === 'password') {
            res.status(200).json({ success: true });
        } else {
            res.status(401).json({ success: false });
        }
    }
);

export default router;
