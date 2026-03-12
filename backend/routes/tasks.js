const express = require('express');
const router = express.Router();
const Task = require('../models/Task');
const authMiddleware = require('../middleware/authMiddleware');

// Apply middleware to all routes
router.use(authMiddleware);

// GET /api/tasks
router.get('/', async (req, res) => {
  try {
    const query = { user: req.user.id };

    if (req.query.status) query.status = req.query.status;
    if (req.query.priority) query.priority = req.query.priority;
    if (req.query.category) query.category = req.query.category;
    if (req.query.search) {
      query.title = { $regex: req.query.search, $options: 'i' };
    }

    const tasks = await Task.find(query).sort({ createdAt: -1 });
    res.json(tasks);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Server Error' });
  }
});

// POST /api/tasks
router.post('/', async (req, res) => {
  try {
    const { title, description, dueDate, priority, status, category } = req.body;

    const newTask = new Task({
      title,
      description,
      dueDate,
      priority,
      status,
      category,
      user: req.user.id,
    });

    const task = await newTask.save();
    res.status(201).json(task);
  } catch (error) {
    console.error(error.message);
    res.status(400).json({ message: 'Bad request' });
  }
});

// PUT /api/tasks/:id
router.put('/:id', async (req, res) => {
  try {
    // Find task
    let task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Verify ownership
    if (task.user.toString() !== req.user.id) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    // Update task
    task = await Task.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true } // format returns the updated document
    );

    res.json(task);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Server Error' });
  }
});

// DELETE /api/tasks/:id
router.delete('/:id', async (req, res) => {
  try {
    // Find task
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Verify ownership
    if (task.user.toString() !== req.user.id) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    // Delete task
    await task.deleteOne();

    res.json({ message: 'Task removed' });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;
