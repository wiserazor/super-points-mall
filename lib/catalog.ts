export type Profile = "luke" | "lilian";
export type RuleKind = "reward" | "penalty";
export type RuleCategory = "健康" | "学习" | "成长" | "运动" | "比赛" | "勇敢纠正";

export type PointRule = {
  id: string;
  label: string;
  points: number;
  icon: string;
  category: RuleCategory;
  unit?: string;
  kind: RuleKind;
  daily?: boolean;
  active?: boolean;
  custom?: boolean;
};

export type StoreItem = {
  id: string;
  label: string;
  cost: number;
  icon: string;
  category: "游戏时间" | "快乐体验" | "礼物" | "零花钱";
  unit: string;
  pending?: boolean;
  active?: boolean;
  custom?: boolean;
};

export const RULE_CATEGORIES: RuleCategory[] = ["健康", "学习", "成长", "运动", "比赛", "勇敢纠正"];
export const STORE_CATEGORIES: StoreItem["category"][] = ["游戏时间", "快乐体验", "礼物", "零花钱"];

export const PROFILES = {
  luke: { name: "Luke", chineseName: "徐麓柯", avatar: "🦊", color: "blue" },
  lilian: { name: "Lilian", chineseName: "徐李黎安", avatar: "🐰", color: "pink" },
} as const satisfies Record<Profile, { name: string; chineseName: string; avatar: string; color: string }>;

export const POINT_RULES: PointRule[] = [
  { id: "healthy-food", label: "吃健康食品", points: 20, icon: "🥗", category: "健康", kind: "reward" },
  { id: "no-sugary-drink", label: "今天不喝饮料、不吃糖", points: 20, icon: "💧", category: "健康", kind: "reward", daily: true },
  { id: "drink-water", label: "完成今天的喝水目标", points: 50, icon: "🥤", category: "健康", kind: "reward", daily: true },
  { id: "ipad-under-45", label: "娱乐 iPad 不超过 45 分钟", points: 100, icon: "⏱️", category: "健康", kind: "reward", daily: true },
  { id: "polite", label: "做了一件礼貌的事", points: 20, icon: "🌟", category: "成长", kind: "reward" },
  { id: "help-others", label: "帮助他人", points: 20, icon: "🤝", category: "成长", kind: "reward" },
  { id: "sleep-alone", label: "独立睡觉", points: 20, icon: "🌙", category: "成长", kind: "reward", daily: true },
  { id: "wake-up", label: "独立早起", points: 20, icon: "🌤️", category: "成长", kind: "reward", daily: true },
  { id: "shanghainese", label: "讲上海话", points: 20, icon: "💬", category: "成长", kind: "reward" },
  { id: "country", label: "认识一个新国家", points: 20, icon: "🗺️", category: "成长", kind: "reward" },
  { id: "travel-chinese", label: "旅行时主动用中文沟通", points: 50, icon: "🗣️", category: "成长", kind: "reward" },
  { id: "travel-language", label: "旅行时主动用外语沟通", points: 80, icon: "🌍", category: "成长", kind: "reward" },
  { id: "homework-on-time", label: "按时完成今天的作业", points: 50, icon: "✅", category: "学习", kind: "reward", daily: true },
  { id: "read-cn", label: "阅读中文书 20 分钟", points: 30, icon: "📖", category: "学习", kind: "reward" },
  { id: "read-raz", label: "阅读英文 RAZ 20 分钟", points: 100, icon: "📚", category: "学习", kind: "reward" },
  { id: "knowledge-answer", label: "知识问答答对", points: 30, icon: "💡", category: "学习", unit: "每题", kind: "reward" },
  { id: "duolingo", label: "完成多邻国练习", points: 5, icon: "🦉", category: "学习", kind: "reward" },
  { id: "read-french", label: "大声读法语", points: 10, icon: "🇫🇷", category: "学习", kind: "reward" },
  { id: "spark", label: "完成 Spark 测试", points: 100, icon: "✨", category: "学习", kind: "reward" },
  { id: "vocabulary", label: "完成背单词", points: 30, icon: "🔤", category: "学习", kind: "reward" },
  { id: "pet", label: "完成 PET 练习", points: 100, icon: "📝", category: "学习", kind: "reward" },
  { id: "ted", label: "录制完成 TED 视频", points: 50, icon: "🎙️", category: "学习", kind: "reward" },
  { id: "math-notes", label: "把数学笔记带回来", points: 100, icon: "📒", category: "学习", kind: "reward" },
  { id: "holiday-task", label: "完成寒暑假任务", points: 50, icon: "🧩", category: "学习", kind: "reward" },
  { id: "school-a", label: "学校主课评价 A", points: 500, icon: "🅰️", category: "比赛", kind: "reward" },
  { id: "exam-first", label: "学校考试第一名", points: 2000, icon: "🥇", category: "比赛", kind: "reward" },
  { id: "exam-second", label: "学校考试第二名", points: 1000, icon: "🥈", category: "比赛", kind: "reward" },
  { id: "exam-third", label: "学校考试第三名", points: 500, icon: "🥉", category: "比赛", kind: "reward" },
  { id: "contest-gold", label: "课外比赛一等奖 / Golden Prize", points: 2000, icon: "🏆", category: "比赛", kind: "reward" },
  { id: "contest-silver", label: "课外比赛二等奖 / Silver Prize", points: 1000, icon: "🏅", category: "比赛", kind: "reward" },
  { id: "contest-bronze", label: "课外比赛三等奖 / Bronze Prize", points: 600, icon: "🎖️", category: "比赛", kind: "reward" },
  { id: "chess-level", label: "国际象棋等级升级", points: 200, icon: "♟️", category: "比赛", kind: "reward" },
  { id: "english-pass", label: "英语考级通过", points: 300, icon: "🎓", category: "比赛", kind: "reward" },
  { id: "english-excellent", label: "英语考级优秀", points: 1000, icon: "🌠", category: "比赛", kind: "reward" },
  { id: "english-outstanding", label: "英语考级卓越", points: 2000, icon: "🚀", category: "比赛", kind: "reward" },
  { id: "practice-10", label: "竞赛练习答对 10 题", points: 50, icon: "🔟", category: "比赛", kind: "reward" },
  { id: "practice-15", label: "竞赛练习答对 15 题", points: 200, icon: "💯", category: "比赛", kind: "reward" },
  { id: "practice-20", label: "竞赛练习答对 20 题", points: 500, icon: "🌈", category: "比赛", kind: "reward" },
  { id: "basketball-shot", label: "篮球课命中投篮", points: 5, icon: "🏀", category: "运动", unit: "每球", kind: "reward" },
  { id: "basketball-good", label: "篮球课表现良好 / 跑步", points: 10, icon: "🏃", category: "运动", kind: "reward" },
  { id: "high-jump", label: "完成跳高挑战", points: 10, icon: "🤸", category: "运动", kind: "reward" },
  { id: "hike", label: "完成徒步", points: 150, icon: "🥾", category: "运动", kind: "reward" },

  { id: "uncivil", label: "说不文明的话或做不文明动作", points: -200, icon: "🫢", category: "勇敢纠正", kind: "penalty" },
  { id: "lie", label: "说谎", points: -500, icon: "🤥", category: "勇敢纠正", kind: "penalty" },
  { id: "exam-last", label: "学校考试倒数第一", points: -2000, icon: "📉", category: "勇敢纠正", kind: "penalty" },
  { id: "exam-second-last", label: "学校考试倒数第二", points: -1000, icon: "📉", category: "勇敢纠正", kind: "penalty" },
  { id: "exam-third-last", label: "学校考试倒数第三", points: -500, icon: "📉", category: "勇敢纠正", kind: "penalty" },
  { id: "school-d", label: "学校评价 D", points: -500, icon: "📋", category: "勇敢纠正", kind: "penalty" },
  { id: "school-f", label: "学校评价 F", points: -800, icon: "📋", category: "勇敢纠正", kind: "penalty" },
  { id: "secret-game", label: "偷玩手机或游戏 10 分钟", points: -500, icon: "🎮", category: "勇敢纠正", unit: "每 10 分钟", kind: "penalty" },
  { id: "hamster-eating", label: "吃饭像小仓鼠一样拖拉", points: -500, icon: "🐹", category: "勇敢纠正", kind: "penalty" },
  { id: "sleep-in", label: "早上赖床", points: -30, icon: "😴", category: "勇敢纠正", kind: "penalty" },
  { id: "secret-tv", label: "偷看电视 10 分钟", points: -500, icon: "📺", category: "勇敢纠正", unit: "每 10 分钟", kind: "penalty" },
  { id: "math-no-steps", label: "计算题没写步骤且答错 / 漏题", points: -50, icon: "➗", category: "勇敢纠正", kind: "penalty" },
  { id: "forget-math-notes", label: "数学笔记没带回或没带去学校", points: -200, icon: "📒", category: "勇敢纠正", kind: "penalty" },
  { id: "bite", label: "咬人", points: -500, icon: "🦷", category: "勇敢纠正", kind: "penalty" },
  { id: "ipad-over-45", label: "娱乐 iPad 超过 45 分钟", points: -100, icon: "📱", category: "勇敢纠正", kind: "penalty" },
  { id: "candy", label: "吃糖", points: -20, icon: "🍬", category: "勇敢纠正", unit: "每颗", kind: "penalty" },
  { id: "audio-over-read", label: "喜马拉雅时间超过看书时间", points: -50, icon: "🎧", category: "勇敢纠正", kind: "penalty" },
  { id: "fight", label: "打架", points: -300, icon: "🥊", category: "勇敢纠正", kind: "penalty" },
  { id: "promise", label: "没有完成承诺", points: -200, icon: "🤞", category: "勇敢纠正", kind: "penalty" },
  { id: "trash", label: "牙线或餐巾纸没有扔进垃圾桶", points: -100, icon: "🗑️", category: "勇敢纠正", kind: "penalty" },
  { id: "late-homework", label: "没有按时交作业", points: -300, icon: "⌛", category: "勇敢纠正", unit: "每科", kind: "penalty" },
  { id: "below-average", label: "成绩低于平均分", points: -500, icon: "📊", category: "勇敢纠正", kind: "penalty" },
];

export const STORE_ITEMS: StoreItem[] = [
  { id: "tom-coins", label: "汤姆熊游戏币", cost: 20, icon: "🪙", category: "快乐体验", unit: "2 个" },
  { id: "cartoon-coins", label: "卡通尼游戏币", cost: 20, icon: "🎟️", category: "快乐体验", unit: "2 个" },
  { id: "other-coins", label: "其他游戏币", cost: 20, icon: "🕹️", category: "快乐体验", unit: "2 个" },
  { id: "clash-royale", label: "皇室战争", cost: 50, icon: "👑", category: "游戏时间", unit: "10 分钟" },
  { id: "honor-of-kings", label: "王者荣耀", cost: 100, icon: "⚔️", category: "游戏时间", unit: "20 分钟" },
  { id: "black-myth", label: "黑神话：悟空", cost: 150, icon: "🐒", category: "游戏时间", unit: "30 分钟" },
  { id: "assassins-creed", label: "刺客信条", cost: 100, icon: "🦅", category: "游戏时间", unit: "30 分钟" },
  { id: "minecraft", label: "我的世界", cost: 150, icon: "⛏️", category: "游戏时间", unit: "30 分钟" },
  { id: "hogwarts", label: "Hogwarts Legacy", cost: 150, icon: "🪄", category: "游戏时间", unit: "30 分钟" },
  { id: "switch", label: "Nintendo Switch", cost: 50, icon: "🎮", category: "游戏时间", unit: "10 分钟" },
  { id: "movie-home", label: "在家看电影", cost: 80, icon: "🍿", category: "快乐体验", unit: "20 分钟" },
  { id: "movie-cinema", label: "去影院看电影", cost: 200, icon: "🎬", category: "快乐体验", unit: "1 场", pending: true },
  { id: "gift", label: "买一份礼物", cost: 200, icon: "🎁", category: "礼物", unit: "1 个", pending: true },
  { id: "cash", label: "零花钱", cost: 100, icon: "🧧", category: "零花钱", unit: "1 元" },
  { id: "popmart-friend", label: "泡泡玛特（送同学）", cost: 400, icon: "💝", category: "礼物", unit: "1 个" },
  { id: "popmart", label: "泡泡玛特", cost: 500, icon: "🧸", category: "礼物", unit: "1 个" },
  { id: "ximalaya", label: "喜马拉雅", cost: 50, icon: "🎧", category: "快乐体验", unit: "15 分钟" },
];

export const ruleById = (id: string) => POINT_RULES.find((rule) => rule.id === id);
export const itemById = (id: string) => STORE_ITEMS.find((item) => item.id === id);
