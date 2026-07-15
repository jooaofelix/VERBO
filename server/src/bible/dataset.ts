export interface CuratedVerse {
  book: string;
  chapterStart: number;
  verseStart: number;
  chapterEnd?: number;
  verseEnd?: number;
  referenceLabel: string;
  text: string;
  /** Alternate ways this reference might be typed/searched. */
  aliases: string[];
}

/**
 * A small, hand-curated set of very well-known, textually stable verses,
 * transcribed from the historic Almeida translation (public domain in
 * Portuguese due to its age). This is NOT a complete Bible and is NOT a
 * substitute for an official translation or print edition.
 *
 * IMPORTANT — read before extending this file:
 * - Only add verses you are confident are stable/famous enough that the
 *   classic wording is not seriously in dispute.
 * - Every lookup response carries BIBLE_DATASET_DISCLAIMER — never remove it.
 * - If a reference the AI identifies is not in this list, the app must show
 *   only the reference + explanation, never a fabricated verse text.
 */
export const BIBLE_DATASET_DISCLAIMER =
  "Texto de domínio público (base histórica Almeida), reproduzido para uso devocional e de estudo. " +
  "A redação pode diferir ligeiramente de edições modernas registradas (como ARC, ACF, NVI ou NAA). " +
  "Confirme a citação exata em uma Bíblia impressa ou aplicativo oficial antes de publicar ou citar formalmente.";

export const CURATED_VERSES: CuratedVerse[] = [
  {
    book: "Gênesis",
    chapterStart: 1,
    verseStart: 1,
    referenceLabel: "Gênesis 1:1",
    text: "No princípio, criou Deus os céus e a terra.",
    aliases: ["gn 1:1", "genesis 1:1"],
  },
  {
    book: "Números",
    chapterStart: 6,
    verseStart: 24,
    verseEnd: 26,
    referenceLabel: "Números 6:24-26",
    text:
      "O Senhor te abençoe e te guarde; o Senhor faça resplandecer o seu rosto sobre ti e tenha " +
      "misericórdia de ti; o Senhor sobre ti levante o seu rosto e te dê a paz.",
    aliases: ["nm 6:24-26", "numeros 6:24-26"],
  },
  {
    book: "Deuteronômio",
    chapterStart: 31,
    verseStart: 6,
    referenceLabel: "Deuteronômio 31:6",
    text:
      "Esforça-te, e tem bom ânimo; não temas, nem te espantes diante deles, porque o Senhor, teu " +
      "Deus, é o que vai contigo; não te deixará, nem te desamparará.",
    aliases: ["dt 31:6", "deuteronomio 31:6"],
  },
  {
    book: "Josué",
    chapterStart: 1,
    verseStart: 9,
    referenceLabel: "Josué 1:9",
    text:
      "Não to mandei eu? Esforça-te, e tem bom ânimo; não temas, nem te espantes; porque o Senhor, " +
      "teu Deus, é contigo, por onde quer que andares.",
    aliases: ["js 1:9", "josue 1:9"],
  },
  {
    book: "Salmos",
    chapterStart: 23,
    verseStart: 1,
    verseEnd: 4,
    referenceLabel: "Salmos 23:1-4",
    text:
      "O Senhor é o meu pastor, nada me faltará. Deitar-me faz em verdes pastos, guia-me mansamente " +
      "a águas tranquilas. Refrigera a minha alma; guia-me pelas veredas da justiça, por amor do seu nome. " +
      "Ainda que eu andasse pelo vale da sombra da morte, não temeria mal algum, porque tu estás comigo.",
    aliases: ["sl 23", "salmo 23"],
  },
  {
    book: "Salmos",
    chapterStart: 27,
    verseStart: 1,
    referenceLabel: "Salmos 27:1",
    text: "O Senhor é a minha luz e a minha salvação; a quem temerei? O Senhor é a força da minha vida; de quem me recearei?",
    aliases: ["sl 27:1", "salmo 27:1"],
  },
  {
    book: "Salmos",
    chapterStart: 34,
    verseStart: 8,
    referenceLabel: "Salmos 34:8",
    text: "Provai, e vede que o Senhor é bom; bem-aventurado o homem que nele confia.",
    aliases: ["sl 34:8", "salmo 34:8"],
  },
  {
    book: "Salmos",
    chapterStart: 46,
    verseStart: 1,
    referenceLabel: "Salmos 46:1",
    text: "Deus é o nosso refúgio e fortaleza, socorro bem presente na angústia.",
    aliases: ["sl 46:1", "salmo 46:1"],
  },
  {
    book: "Salmos",
    chapterStart: 51,
    verseStart: 10,
    referenceLabel: "Salmos 51:10",
    text: "Cria em mim, ó Deus, um coração puro, e renova em mim um espírito reto.",
    aliases: ["sl 51:10", "salmo 51:10"],
  },
  {
    book: "Salmos",
    chapterStart: 63,
    verseStart: 1,
    referenceLabel: "Salmos 63:1",
    text: "Ó Deus, tu és o meu Deus, de madrugada te buscarei; a minha alma tem sede de ti.",
    aliases: ["sl 63:1", "salmo 63:1"],
  },
  {
    book: "Salmos",
    chapterStart: 84,
    verseStart: 1,
    verseEnd: 2,
    referenceLabel: "Salmos 84:1-2",
    text:
      "Quão amáveis são os teus tabernáculos, Senhor dos Exércitos! A minha alma está desejosa, e até " +
      "desfalece pelos átrios do Senhor; o meu coração e a minha carne clamam pelo Deus vivo.",
    aliases: ["sl 84:1-2", "salmo 84:1-2"],
  },
  {
    book: "Salmos",
    chapterStart: 91,
    verseStart: 1,
    verseEnd: 2,
    referenceLabel: "Salmos 91:1-2",
    text:
      "Aquele que habita no esconderijo do Altíssimo, à sombra do Onipotente descansará. Direi do " +
      "Senhor: Ele é o meu Deus, o meu refúgio, a minha fortaleza, e nele confiarei.",
    aliases: ["sl 91:1-2", "salmo 91:1-2"],
  },
  {
    book: "Salmos",
    chapterStart: 121,
    verseStart: 1,
    verseEnd: 2,
    referenceLabel: "Salmos 121:1-2",
    text:
      "Elevo os meus olhos aos montes, de onde vem o meu socorro. O meu socorro vem do Senhor, que " +
      "fez os céus e a terra.",
    aliases: ["sl 121:1-2", "salmo 121:1-2"],
  },
  {
    book: "Salmos",
    chapterStart: 139,
    verseStart: 14,
    referenceLabel: "Salmos 139:14",
    text:
      "Eu te louvarei, porque de um modo assombroso e maravilhoso fui formado; maravilhosas são as " +
      "tuas obras, e a minha alma o sabe muito bem.",
    aliases: ["sl 139:14", "salmo 139:14"],
  },
  {
    book: "Provérbios",
    chapterStart: 3,
    verseStart: 5,
    verseEnd: 6,
    referenceLabel: "Provérbios 3:5-6",
    text:
      "Confia no Senhor de todo o teu coração e não te estribes no teu próprio entendimento. " +
      "Reconhece-o em todos os teus caminhos, e ele endireitará as tuas veredas.",
    aliases: ["pv 3:5-6", "proverbios 3:5-6"],
  },
  {
    book: "Isaías",
    chapterStart: 40,
    verseStart: 31,
    referenceLabel: "Isaías 40:31",
    text:
      "Mas os que esperam no Senhor renovarão as forças, subirão com asas como águias; correrão, e " +
      "não se cansarão; caminharão, e não se fatigarão.",
    aliases: ["is 40:31", "isaias 40:31"],
  },
  {
    book: "Isaías",
    chapterStart: 41,
    verseStart: 10,
    referenceLabel: "Isaías 41:10",
    text:
      "Não temas, porque eu sou contigo; não te assombres, porque eu sou o teu Deus; eu te fortaleço, " +
      "e te ajudo, e te sustento com a destra da minha justiça.",
    aliases: ["is 41:10", "isaias 41:10"],
  },
  {
    book: "Jeremias",
    chapterStart: 29,
    verseStart: 11,
    referenceLabel: "Jeremias 29:11",
    text:
      "Porque eu bem sei os pensamentos que penso a vosso respeito, diz o Senhor; pensamentos de paz, " +
      "e não de mal, para vos dar o fim que esperais.",
    aliases: ["jr 29:11", "jeremias 29:11"],
  },
  {
    book: "Lamentações",
    chapterStart: 3,
    verseStart: 22,
    verseEnd: 23,
    referenceLabel: "Lamentações 3:22-23",
    text:
      "As misericórdias do Senhor são a causa de não sermos consumidos; porque as suas misericórdias " +
      "não têm fim; renovam-se cada manhã. Grande é a tua fidelidade.",
    aliases: ["lm 3:22-23", "lamentacoes 3:22-23"],
  },
  {
    book: "Sofonias",
    chapterStart: 3,
    verseStart: 17,
    referenceLabel: "Sofonias 3:17",
    text:
      "O Senhor, teu Deus, está no meio de ti, poderoso para te salvar; ele se deleitará em ti com " +
      "alegria; calar-se-á por seu amor; ele se regozijará em ti com cânticos.",
    aliases: ["sf 3:17", "sofonias 3:17"],
  },
  {
    book: "Habacuque",
    chapterStart: 3,
    verseStart: 17,
    verseEnd: 18,
    referenceLabel: "Habacuque 3:17-18",
    text:
      "Ainda que a figueira não floresça, e não haja fruto na vide; ainda que falhe o produto da " +
      "oliveira, e os campos não produzam mantimento... todavia, eu me alegrarei no Senhor, eu me " +
      "regozijarei no Deus da minha salvação.",
    aliases: ["hc 3:17-18", "habacuque 3:17-18"],
  },
  {
    book: "Mateus",
    chapterStart: 11,
    verseStart: 28,
    referenceLabel: "Mateus 11:28",
    text: "Vinde a mim, todos os que estais cansados e oprimidos, e eu vos aliviarei.",
    aliases: ["mt 11:28", "mateus 11:28"],
  },
  {
    book: "Mateus",
    chapterStart: 28,
    verseStart: 20,
    referenceLabel: "Mateus 28:20",
    text: "E eis que estou convosco todos os dias, até a consumação dos séculos.",
    aliases: ["mt 28:20", "mateus 28:20"],
  },
  {
    book: "Marcos",
    chapterStart: 11,
    verseStart: 24,
    referenceLabel: "Marcos 11:24",
    text:
      "Por isso, vos digo que tudo o que pedirdes, orando, crede que o recebereis, e tê-lo-eis.",
    aliases: ["mc 11:24", "marcos 11:24"],
  },
  {
    book: "Lucas",
    chapterStart: 1,
    verseStart: 37,
    referenceLabel: "Lucas 1:37",
    text: "Porque para Deus nada é impossível.",
    aliases: ["lc 1:37", "lucas 1:37"],
  },
  {
    book: "João",
    chapterStart: 3,
    verseStart: 16,
    referenceLabel: "João 3:16",
    text:
      "Porque Deus amou o mundo de tal maneira que deu o seu Filho unigênito, para que todo aquele " +
      "que nele crê não pereça, mas tenha a vida eterna.",
    aliases: ["jo 3:16", "joao 3:16"],
  },
  {
    book: "João",
    chapterStart: 14,
    verseStart: 6,
    referenceLabel: "João 14:6",
    text: "Eu sou o caminho, e a verdade, e a vida; ninguém vem ao Pai, senão por mim.",
    aliases: ["jo 14:6", "joao 14:6"],
  },
  {
    book: "Romanos",
    chapterStart: 8,
    verseStart: 28,
    referenceLabel: "Romanos 8:28",
    text:
      "E sabemos que todas as coisas contribuem juntamente para o bem daqueles que amam a Deus, " +
      "daqueles que são chamados segundo o seu propósito.",
    aliases: ["rm 8:28", "romanos 8:28"],
  },
  {
    book: "Romanos",
    chapterStart: 8,
    verseStart: 38,
    verseEnd: 39,
    referenceLabel: "Romanos 8:38-39",
    text:
      "Porque estou certo de que nem a morte, nem a vida, nem os anjos, nem os principados, nem as " +
      "potestades, nem o presente, nem o porvir, nem a altura, nem a profundidade, nem alguma outra " +
      "criatura nos poderá separar do amor de Deus, que está em Cristo Jesus, nosso Senhor.",
    aliases: ["rm 8:38-39", "romanos 8:38-39"],
  },
  {
    book: "Romanos",
    chapterStart: 12,
    verseStart: 1,
    verseEnd: 2,
    referenceLabel: "Romanos 12:1-2",
    text:
      "Rogo-vos, pois, irmãos, pela compaixão de Deus, que apresenteis os vossos corpos em " +
      "sacrifício vivo, santo e agradável a Deus, que é o vosso culto racional. E não vos conformeis " +
      "com este século, mas transformai-vos pela renovação do vosso entendimento.",
    aliases: ["rm 12:1-2", "romanos 12:1-2"],
  },
  {
    book: "1 Coríntios",
    chapterStart: 13,
    verseStart: 4,
    verseEnd: 7,
    referenceLabel: "1 Coríntios 13:4-7",
    text:
      "O amor é sofredor, é benigno; o amor não é invejoso; o amor não trata com leviandade, não se " +
      "ensoberbece, não se porta com indecência, não busca os seus interesses, não se irrita, não " +
      "suspeita mal; não se regozija com a injustiça, mas regozija-se com a verdade; tudo sofre, " +
      "tudo crê, tudo espera, tudo suporta.",
    aliases: ["1co 13:4-7", "1 corintios 13:4-7"],
  },
  {
    book: "2 Coríntios",
    chapterStart: 5,
    verseStart: 17,
    referenceLabel: "2 Coríntios 5:17",
    text:
      "Assim que, se alguém está em Cristo, nova criatura é: as coisas velhas já passaram; eis que " +
      "tudo se fez novo.",
    aliases: ["2co 5:17", "2 corintios 5:17"],
  },
  {
    book: "Gálatas",
    chapterStart: 2,
    verseStart: 20,
    referenceLabel: "Gálatas 2:20",
    text:
      "Já estou crucificado com Cristo; e vivo, não mais eu, mas Cristo vive em mim; e a vida que " +
      "agora vivo na carne vivo-a na fé do Filho de Deus, o qual me amou, e se entregou a si mesmo por mim.",
    aliases: ["gl 2:20", "galatas 2:20"],
  },
  {
    book: "Efésios",
    chapterStart: 2,
    verseStart: 8,
    verseEnd: 9,
    referenceLabel: "Efésios 2:8-9",
    text:
      "Porque pela graça sois salvos, por meio da fé; e isto não vem de vós; é dom de Deus. Não vem " +
      "das obras, para que ninguém se glorie.",
    aliases: ["ef 2:8-9", "efesios 2:8-9"],
  },
  {
    book: "Efésios",
    chapterStart: 3,
    verseStart: 20,
    referenceLabel: "Efésios 3:20",
    text:
      "Ora, àquele que é poderoso para fazer tudo muito mais abundantemente além daquilo que " +
      "pedimos ou pensamos, segundo o poder que em nós opera.",
    aliases: ["ef 3:20", "efesios 3:20"],
  },
  {
    book: "Filipenses",
    chapterStart: 4,
    verseStart: 6,
    verseEnd: 7,
    referenceLabel: "Filipenses 4:6-7",
    text:
      "Não estejais inquietos por coisa alguma; antes, as vossas petições sejam em tudo conhecidas " +
      "diante de Deus, pela oração e súplicas, com ação de graças. E a paz de Deus, que excede todo o " +
      "entendimento, guardará os vossos corações e os vossos sentimentos em Cristo Jesus.",
    aliases: ["fp 4:6-7", "filipenses 4:6-7"],
  },
  {
    book: "Filipenses",
    chapterStart: 4,
    verseStart: 13,
    referenceLabel: "Filipenses 4:13",
    text: "Posso todas as coisas em Cristo que me fortalece.",
    aliases: ["fp 4:13", "filipenses 4:13"],
  },
  {
    book: "Colossenses",
    chapterStart: 3,
    verseStart: 16,
    referenceLabel: "Colossenses 3:16",
    text:
      "A palavra de Cristo habite em vós ricamente, em toda a sabedoria, ensinando-vos e " +
      "admoestando-vos uns aos outros, com salmos e hinos, e cânticos espirituais, cantando ao " +
      "Senhor com graça em vosso coração.",
    aliases: ["cl 3:16", "colossenses 3:16"],
  },
  {
    book: "Tiago",
    chapterStart: 1,
    verseStart: 2,
    verseEnd: 3,
    referenceLabel: "Tiago 1:2-3",
    text:
      "Meus irmãos, tende grande gozo quando cairdes em várias tentações, sabendo que a prova da " +
      "vossa fé produz a paciência.",
    aliases: ["tg 1:2-3", "tiago 1:2-3"],
  },
  {
    book: "1 Pedro",
    chapterStart: 5,
    verseStart: 7,
    referenceLabel: "1 Pedro 5:7",
    text: "Lançando sobre ele toda a vossa ansiedade, porque ele tem cuidado de vós.",
    aliases: ["1pe 5:7", "1 pedro 5:7"],
  },
  {
    book: "1 João",
    chapterStart: 1,
    verseStart: 9,
    referenceLabel: "1 João 1:9",
    text:
      "Se confessarmos os nossos pecados, ele é fiel e justo para nos perdoar os pecados, e nos " +
      "purificar de toda a injustiça.",
    aliases: ["1jo 1:9", "1 joao 1:9"],
  },
  {
    book: "1 João",
    chapterStart: 4,
    verseStart: 8,
    referenceLabel: "1 João 4:8",
    text: "Aquele que não ama não conhece a Deus; porque Deus é amor.",
    aliases: ["1jo 4:8", "1 joao 4:8"],
  },
  {
    book: "Hebreus",
    chapterStart: 11,
    verseStart: 1,
    referenceLabel: "Hebreus 11:1",
    text:
      "Ora, a fé é o firme fundamento das coisas que se esperam, e a prova das coisas que se não veem.",
    aliases: ["hb 11:1", "hebreus 11:1"],
  },
  {
    book: "Hebreus",
    chapterStart: 12,
    verseStart: 1,
    verseEnd: 2,
    referenceLabel: "Hebreus 12:1-2",
    text:
      "Corramos, com paciência, a carreira que nos está proposta, olhando para Jesus, autor e " +
      "consumador da fé.",
    aliases: ["hb 12:1-2", "hebreus 12:1-2"],
  },
  {
    book: "Apocalipse",
    chapterStart: 21,
    verseStart: 4,
    referenceLabel: "Apocalipse 21:4",
    text:
      "E Deus limpará de seus olhos toda lágrima; e não haverá mais morte, nem pranto, nem clamor, " +
      "nem dor; porque já as primeiras coisas são passadas.",
    aliases: ["ap 21:4", "apocalipse 21:4"],
  },
];
