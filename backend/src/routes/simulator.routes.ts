import { Router } from 'express';
import { triggerKeypadEntry } from '../controllers/simulator.controller';

const router = Router();

// Keypad click simulator proxy (open endpoint for browser demo simulation)
router.post('/keypad', triggerKeypadEntry);

export default router;
