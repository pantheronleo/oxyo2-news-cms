module.exports={apps:[
  {name:'cms-api',cwd:__dirname,script:'apps/api/dist/server.js',instances:1,exec_mode:'fork',env:{NODE_ENV:'production'},max_memory_restart:'600M',kill_timeout:10000,listen_timeout:10000,time:true},
  {name:'cms-news-bot-worker',cwd:__dirname,script:'apps/api/dist/news-bot/worker.js',instances:1,exec_mode:'fork',env:{NODE_ENV:'production',RUN_NEWS_BOT_WORKER:'true'},max_memory_restart:'600M',kill_timeout:30000,listen_timeout:10000,time:true}
]}
