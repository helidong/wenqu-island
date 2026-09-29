window.GD = window.GD || {};

// 声母 23 个（含 y、w），rep 为呼读音代表字，供语音朗读
GD.initials = [
  {p:"b", rep:"玻", tip:"右下半圆 b b b"}, {p:"p", rep:"坡", tip:"右上半圆 p p p"},
  {p:"m", rep:"摸", tip:"两个门洞 m m m"}, {p:"f", rep:"佛", tip:"一根拐棍 f f f"},
  {p:"d", rep:"得", tip:"左下半圆 d d d"}, {p:"t", rep:"特", tip:"伞把朝下 t t t"},
  {p:"n", rep:"讷", tip:"一个门洞 n n n"}, {p:"l", rep:"勒", tip:"一根小棍 l l l"},
  {p:"g", rep:"哥", tip:"9字加弯 g g g"}, {p:"k", rep:"科", tip:"一挺机枪 k k k"},
  {p:"h", rep:"喝", tip:"一把椅子 h h h"}, {p:"j", rep:"鸡", tip:"i 下加弯 j j j"},
  {p:"q", rep:"七", tip:"左上半圆 q q q"}, {p:"x", rep:"西", tip:"一个叉号 x x x"},
  {p:"zh", rep:"知", tip:"翘舌音 zh"}, {p:"ch", rep:"吃", tip:"翘舌音 ch"},
  {p:"sh", rep:"诗", tip:"翘舌音 sh"}, {p:"r", rep:"日", tip:"翘舌音 r"},
  {p:"z", rep:"资", tip:"平舌音 z"}, {p:"c", rep:"雌", tip:"平舌音 c"},
  {p:"s", rep:"思", tip:"平舌音 s"}, {p:"y", rep:"衣", tip:"树杈 y y y"},
  {p:"w", rep:"乌", tip:"屋顶 w w w"}
];

// 韵母 24 个
GD.finals = [
  {p:"a", rep:"啊", kind:"单韵母"}, {p:"o", rep:"喔", kind:"单韵母"}, {p:"e", rep:"鹅", kind:"单韵母"},
  {p:"i", rep:"衣", kind:"单韵母"}, {p:"u", rep:"乌", kind:"单韵母"}, {p:"ü", rep:"迂", kind:"单韵母"},
  {p:"ai", rep:"哀", kind:"复韵母"}, {p:"ei", rep:"欸", kind:"复韵母"}, {p:"ui", rep:"威", kind:"复韵母"},
  {p:"ao", rep:"熬", kind:"复韵母"}, {p:"ou", rep:"欧", kind:"复韵母"}, {p:"iu", rep:"优", kind:"复韵母"},
  {p:"ie", rep:"耶", kind:"复韵母"}, {p:"üe", rep:"约", kind:"复韵母"}, {p:"er", rep:"耳", kind:"特殊韵母"},
  {p:"an", rep:"安", kind:"前鼻韵母"}, {p:"en", rep:"恩", kind:"前鼻韵母"}, {p:"in", rep:"因", kind:"前鼻韵母"},
  {p:"un", rep:"温", kind:"前鼻韵母"}, {p:"ün", rep:"晕", kind:"前鼻韵母"},
  {p:"ang", rep:"昂", kind:"后鼻韵母"}, {p:"eng", rep:"鞥", kind:"后鼻韵母"},
  {p:"ing", rep:"英", kind:"后鼻韵母"}, {p:"ong", rep:"嗡", kind:"后鼻韵母"}
];

// 整体认读音节 16 个
GD.wholes = [
  {p:"zhi", rep:"知"}, {p:"chi", rep:"吃"}, {p:"shi", rep:"诗"}, {p:"ri", rep:"日"},
  {p:"zi", rep:"资"}, {p:"ci", rep:"词"}, {p:"si", rep:"思"}, {p:"yi", rep:"衣"},
  {p:"wu", rep:"乌"}, {p:"yu", rep:"鱼"}, {p:"ye", rep:"叶"}, {p:"yue", rep:"月"},
  {p:"yuan", rep:"圆"}, {p:"yin", rep:"音"}, {p:"yun", rep:"云"}, {p:"ying", rep:"鹰"}
];

// 四声示范组
GD.toneSets = [
  {base:"ma", chars:["妈","麻","马","骂"]}, {base:"yi", chars:["衣","姨","椅","意"]},
  {base:"ba", chars:["八","拔","把","爸"]}, {base:"wu", chars:["屋","无","五","雾"]},
  {base:"tang", chars:["汤","糖","躺","烫"]}, {base:"shi", chars:["诗","十","使","是"]},
  {base:"hua", chars:["花","华","",""]}, {base:"yu", chars:["迂","鱼","雨","玉"]},
  {base:"tu", chars:["秃","图","土","兔"]}, {base:"qi", chars:["七","骑","起","气"]}
].filter(s => s.chars.every(Boolean));

GD.pinyinRhymes = [
  {t:"四声歌", c:"一声平，二声扬，三声拐弯，四声降。"},
  {t:"ü 的规则", c:"小ü见了 j q x，摘下帽子行个礼；小ü见了 y，去掉两点还读ü。"},
  {t:"标调歌", c:"有 a 不放过，没 a 找 o e，i u 并列标在后，单个韵母不用说。"},
  {t:"i 的标调", c:"i 上标调把点抹，比如 yī、nǐ、qì。"},
  {t:"平翘舌", c:"z c s 是平舌，zh ch sh r 要翘舌。"},
  {t:"前后鼻", c:"an en in un ün 前鼻音，ang eng ing ong 后鼻音。"}
];
