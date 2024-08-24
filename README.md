# Extension-LiveChat
Adds "Live Chat" functionality on sillytavern for using youtube live stream.

## Description
this is modified from idle extension from sillytavern, but you can still use Extension-Idle seperately.

if you like my code and used it, please support me on ko-fi [https://ko-fi.com/megaaziib](https://ko-fi.com/megaaziib)

use my local api youtube live chat to setting up first: [https://github.com/aziib/YoutubeLiveChatLocalApi](https://github.com/aziib/YoutubeLiveChatLocalApi)

## How To Use
1.  ̶i̶f̶ ̶y̶o̶u̶ ̶a̶l̶r̶e̶a̶d̶y̶ ̶i̶n̶s̶t̶a̶l̶l̶e̶d̶ ̶e̶x̶t̶e̶n̶s̶i̶o̶n̶-̶i̶d̶l̶e̶,̶ ̶r̶e̶m̶o̶v̶e̶ ̶i̶t̶ ̶b̶e̶c̶a̶u̶s̶e̶ ̶i̶t̶ ̶w̶i̶l̶l̶ ̶c̶a̶u̶s̶e̶ ̶i̶s̶s̶u̶e̶s̶.̶
2. install git : [https://git-scm.com/downloads](https://git-scm.com/downloads) (skip if you already installed it)
3. open your SillyTavern folder on windows explorer and then go to public\scripts\extensions\third-party 
4. click on directory path and then type cmd and press enter
5. a command prompt will appear and then type or copy this command line and press enter:
```git
git clone https://github.com/aziib/Extension-LiveChat
```
6. set up a public youtube live stream
7. get your youtube livestream video link
8. setting up my youtube live chat local api : [https://github.com/aziib/YoutubeLiveChatLocalApi](https://github.com/aziib/YoutubeLiveChatLocalApi)
9. run your sillytavern
10. create new persona, set as default, just name it youtube viewer and add description {{user}} is youtube viewers live chat (you can set any description however you want if you want more immmersive interaction between live chat and the ai)
11. select your ai character ( you can use single character or group chat, both are working and can use auto mode on group chat)
12. enable the extension by going to extension tab and click LiveChat (choose the first one if there is two LiveChat)
13. tick enabled checkbox , set livechat count to 9999999999999 ,set livechat timer to 3, untick use continuation, untick randomize time and tick on to enable include livechat prompt
14. also make sure is send as user

