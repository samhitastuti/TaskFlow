import { PrismaClient, Category, TaskStatus, Recurrence, ActionType } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const categories: Category[] = [Category.work, Category.personal, Category.health, Category.learning, Category.other];
const statuses: TaskStatus[] = [
  TaskStatus.pending,
  TaskStatus.pending,
  TaskStatus.pending,
  TaskStatus.in_progress,
  TaskStatus.completed,
  TaskStatus.completed,
  TaskStatus.backlog,
  TaskStatus.archived,
];

async function main() {
  console.log('Seeding database...');

  // Clean up existing seed user
  const existing = await prisma.user.findUnique({ where: { email: 'test@taskflow.dev' } });
  if (existing) {
    // Delete in dependency order
    await prisma.scoreSnapshot.deleteMany({ where: { user_id: existing.id } });
    await prisma.actionLog.deleteMany({ where: { user_id: existing.id } });
    await prisma.notification.deleteMany({ where: { user_id: existing.id } });
    await prisma.session.deleteMany({ where: { user_id: existing.id } });
    await prisma.task.deleteMany({ where: { user_id: existing.id } });
    await prisma.user.delete({ where: { id: existing.id } });
  }

  const passwordHash = await bcrypt.hash('password123', 12);

  const user = await prisma.user.create({
    data: {
      email: 'test@taskflow.dev',
      display_name: 'Test User',
      password_hash: passwordHash,
      onboarding_completed: true,
      working_hours_start: '09:00',
      working_hours_end: '18:00',
      timezone: 'UTC',
      scoring_weight_urgency: 0.4,
      scoring_weight_priority: 0.4,
      scoring_weight_duration: 0.2,
    },
  });

  console.log(`Created user: ${user.email} (id: ${user.id})`);

  const now = new Date();

  const taskData = [
    {
      title: 'Write project proposal',
      notes: 'Draft the Q3 product proposal for stakeholder review',
      deadline: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
      duration_minutes: 120,
      priority_weight: 0.9,
      category: Category.work,
      status: TaskStatus.pending,
      recurrence: Recurrence.none,
    },
    {
      title: 'Review pull requests',
      notes: null,
      deadline: new Date(now.getTime() + 4 * 60 * 60 * 1000),
      duration_minutes: 45,
      priority_weight: 0.7,
      category: Category.work,
      status: TaskStatus.in_progress,
      recurrence: Recurrence.none,
    },
    {
      title: 'Morning workout',
      notes: '30 min cardio + stretching',
      deadline: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000),
      duration_minutes: 45,
      priority_weight: 0.6,
      category: Category.health,
      status: TaskStatus.pending,
      recurrence: Recurrence.daily,
    },
    {
      title: 'Read TypeScript handbook',
      notes: 'Chapters 5-8 on advanced types',
      deadline: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      duration_minutes: 60,
      priority_weight: 0.4,
      category: Category.learning,
      status: TaskStatus.pending,
      recurrence: Recurrence.none,
    },
    {
      title: 'Grocery shopping',
      notes: null,
      deadline: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
      duration_minutes: 30,
      priority_weight: 0.5,
      category: Category.personal,
      status: TaskStatus.backlog,
      recurrence: Recurrence.weekly,
    },
    {
      title: 'Fix login bug',
      notes: 'Users reporting intermittent 401 on refresh',
      deadline: new Date(now.getTime() + 6 * 60 * 60 * 1000),
      duration_minutes: 90,
      priority_weight: 1.0,
      category: Category.work,
      status: TaskStatus.pending,
      recurrence: Recurrence.none,
    },
    {
      title: 'Write unit tests for scheduler',
      notes: 'Cover edge cases: empty queue, all deps unmet',
      deadline: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
      duration_minutes: 60,
      priority_weight: 0.8,
      category: Category.work,
      status: TaskStatus.pending,
      recurrence: Recurrence.none,
    },
    {
      title: 'Dentist appointment',
      notes: null,
      deadline: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000),
      duration_minutes: 60,
      priority_weight: 0.6,
      category: Category.health,
      status: TaskStatus.pending,
      recurrence: Recurrence.none,
    },
    {
      title: 'Meditate',
      notes: 'Use Headspace app',
      deadline: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000),
      duration_minutes: 15,
      priority_weight: 0.3,
      category: Category.personal,
      status: TaskStatus.completed,
      recurrence: Recurrence.daily,
    },
    {
      title: 'Update resume',
      notes: 'Add recent projects and skills',
      deadline: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
      duration_minutes: 90,
      priority_weight: 0.5,
      category: Category.personal,
      status: TaskStatus.backlog,
      recurrence: Recurrence.none,
    },
    {
      title: 'Complete Prisma tutorial',
      notes: 'Focus on migrations and relations',
      deadline: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
      duration_minutes: 75,
      priority_weight: 0.7,
      category: Category.learning,
      status: TaskStatus.pending,
      recurrence: Recurrence.none,
    },
    {
      title: 'Team standup prep',
      notes: null,
      deadline: new Date(now.getTime() + 2 * 60 * 60 * 1000),
      duration_minutes: 15,
      priority_weight: 0.5,
      category: Category.work,
      status: TaskStatus.completed,
      recurrence: Recurrence.daily,
    },
    {
      title: 'Pay utility bills',
      notes: 'Electricity and internet due this week',
      deadline: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
      duration_minutes: 15,
      priority_weight: 0.8,
      category: Category.personal,
      status: TaskStatus.pending,
      recurrence: Recurrence.none,
    },
    {
      title: 'Research Fastify plugins',
      notes: 'Look into rate limiting and auth options',
      deadline: new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000),
      duration_minutes: 45,
      priority_weight: 0.4,
      category: Category.learning,
      status: TaskStatus.archived,
      recurrence: Recurrence.none,
    },
    {
      title: 'Deploy to staging',
      notes: 'Backend v1.2 release candidate',
      deadline: new Date(now.getTime() + 8 * 60 * 60 * 1000),
      duration_minutes: 30,
      priority_weight: 0.9,
      category: Category.work,
      status: TaskStatus.pending,
      recurrence: Recurrence.none,
    },
    {
      title: 'Weekly review',
      notes: 'Reflect on goals, update task list',
      deadline: new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000),
      duration_minutes: 30,
      priority_weight: 0.3,
      category: Category.personal,
      status: TaskStatus.pending,
      recurrence: Recurrence.weekly,
    },
    {
      title: 'Prepare demo for client',
      notes: 'Walk through TaskFlow scheduling UI',
      deadline: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
      duration_minutes: 60,
      priority_weight: 0.85,
      category: Category.work,
      status: TaskStatus.in_progress,
      recurrence: Recurrence.none,
    },
    {
      title: 'Yoga session',
      notes: '30 min flexibility + core',
      deadline: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
      duration_minutes: 30,
      priority_weight: 0.4,
      category: Category.health,
      status: TaskStatus.completed,
      recurrence: Recurrence.daily,
    },
    {
      title: 'Study Redis caching patterns',
      notes: 'Focus on sliding window rate limiting',
      deadline: new Date(now.getTime() + 9 * 24 * 60 * 60 * 1000),
      duration_minutes: 60,
      priority_weight: 0.5,
      category: Category.learning,
      status: TaskStatus.pending,
      recurrence: Recurrence.none,
    },
    {
      title: 'Code review for feature branch',
      notes: null,
      deadline: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000),
      duration_minutes: 45,
      priority_weight: 0.75,
      category: Category.work,
      status: TaskStatus.pending,
      recurrence: Recurrence.none,
    },
  ];

  const createdTasks = [];
  for (const data of taskData) {
    const task = await prisma.task.create({
      data: {
        ...data,
        user_id: user.id,
        completed_at: data.status === TaskStatus.completed ? new Date(now.getTime() - Math.random() * 24 * 60 * 60 * 1000) : null,
        deleted_at: data.status === TaskStatus.archived ? new Date(now.getTime() - 60 * 60 * 1000) : null,
      },
    });
    createdTasks.push(task);
    console.log(`  Created task: "${task.title}" [${task.status}]`);
  }

  // Create some sessions for the completed tasks
  const completedTasks = createdTasks.filter((t) => t.status === TaskStatus.completed);
  for (const task of completedTasks) {
    const startedAt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    const endedAt = new Date(startedAt.getTime() + task.duration_minutes * 60 * 1000);
    await prisma.session.create({
      data: {
        user_id: user.id,
        task_id: task.id,
        started_at: startedAt,
        ended_at: endedAt,
        planned_duration_minutes: task.duration_minutes,
        actual_duration_minutes: task.duration_minutes,
        status: 'completed',
        pause_log: [],
      },
    });
  }

  // Log task creation actions
  await prisma.actionLog.createMany({
    data: createdTasks.map((task) => ({
      user_id: user.id,
      task_id: task.id,
      action: ActionType.task_created,
      payload: { title: task.title },
    })),
  });

  console.log(`\nSeed complete!`);
  console.log(`  User: test@taskflow.dev / password123`);
  console.log(`  Tasks: ${createdTasks.length} created`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
