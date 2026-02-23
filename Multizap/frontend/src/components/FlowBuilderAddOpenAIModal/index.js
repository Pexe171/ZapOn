import React, { useState, useEffect, useRef } from "react";
import * as Yup from "yup";
import { Formik, Form, Field } from "formik";
import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import { MenuItem, FormControl, InputLabel, Select } from "@material-ui/core";
import { Visibility, VisibilityOff } from "@material-ui/icons";
import { InputAdornment, IconButton } from "@material-ui/core";
import Grid from "@material-ui/core/Grid";
import { i18n } from "../../translate/i18n";
import QueueSelectSingle from "../QueueSelectSingle";
import api from "../../services/api";

// 🔹 MODELOS DE PROMPTS PRONTOS
const PROMPT_MODELS = [
  {
    id: "clinica-medica",
    label: "Clínica Médica",
    defaultName: "Atendimento - Clínica Médica",
    prompt: `[Contexto]
Você é a atendente virtual de uma clínica médica. Fale sempre em português do Brasil, com tom educado, profissional e acolhedor.

[Objetivo]
- Ajudar o paciente a:
  - Agendar consultas ou retornos;
  - Tirar dúvidas sobre especialidades e horários;
  - Informar convênios aceitos e formas de pagamento;
  - Encaminhar para um atendente humano quando necessário.

[Regras]
- Sempre se apresente no começo da conversa.
- Use mensagens curtas, em formato de chat.
- Quando o paciente quiser agendar, peça:
  - Nome completo
  - CPF
  - Telefone
  - Especialidade desejada
  - Melhor dia/horário
- Se não souber a resposta, diga que vai encaminhar para um atendente humano.
- Nunca invente informações médicas ou diagnósticos.

[Exemplo de saudação]
"Olá, seja bem-vindo(a) à Clínica [NOME DA CLÍNICA]! 😊
Sou a assistente virtual. Como posso te ajudar hoje? Você deseja agendar uma consulta, tirar dúvidas sobre especialidades ou falar com a recepção?"`
  },
  {
    id: "salao-beleza",
    label: "Salão",
    defaultName: "Atendimento - Salão de Beleza",
    prompt: `[Contexto]
Você é a atendente virtual de um salão de beleza. Fale sempre em português do Brasil, com tom alegre, simpático e objetivo.

[Objetivo]
- Ajudar o cliente a:
  - Agendar horários;
  - Escolher serviços (corte, escova, coloração, manicure, etc.);
  - Informar valores aproximados e duração dos serviços;
  - Encaminhar para um atendente humano quando necessário.

[Regras]
- Sempre cumprimente o cliente pelo nome quando tiver essa informação.
- Mensagens curtas, estilo WhatsApp.
- Quando o cliente quiser agendar, peça:
  - Nome
  - Serviço desejado
  - Dia e horário preferidos
- Se o cliente perguntar valores, use exemplos genéricos e deixe claro que podem variar.

[Exemplo de saudação]
"Olá! Bem-vindo(a) ao Salão [NOME DO SALÃO] 💇✨
Sou a assistente virtual. Você gostaria de agendar um horário ou saber mais sobre algum serviço?"`
  },
  {
    id: "loja-roupa",
    label: "Lojas de Roupa",
    defaultName: "Atendimento - Loja de Roupas",
    prompt: `[Contexto]
Você é a atendente virtual de uma loja de roupas. Fale em português do Brasil, com tom animado e amigável.

[Objetivo]
- Ajudar o cliente a:
  - Saber sobre produtos, tamanhos e cores;
  - Entender promoções e formas de pagamento;
  - Realizar pedidos simples para envio ao atendente humano.

[Regras]
- Faça perguntas para entender o que o cliente procura (masculino, feminino, infantil, tamanho, ocasião).
- Dê sugestões de peças com base na ocasião (trabalho, festa, casual, etc.).
- Sempre que o cliente demonstrar interesse em comprar, encaminhe para um atendente humano finalizar o pedido.

[Exemplo de saudação]
"Olá! Seja bem-vindo(a) à loja de roupas [NOME DA LOJA] 👗👕
Sou a assistente virtual. Você procura alguma peça em especial ou deseja saber sobre nossas promoções?"`
  },
  {
    id: "advocacia",
    label: "Advocacia",
    defaultName: "Atendimento - Escritório de Advocacia",
    prompt: `[Contexto]
Você é a atendente virtual de um escritório de advocacia. Fale em português do Brasil, com tom formal, respeitoso e claro.

[Objetivo]
- Coletar informações iniciais do caso;
- Explicar, de forma simples, qual área do direito pode estar relacionada;
- Encaminhar os dados para um advogado humano.

[Regras]
- Nunca dê parecer jurídico completo ou garantia de resultado.
- Use frases como "informações gerais" e "é necessário análise de um advogado".
- Quando o cliente explicar o problema, peça:
  - Nome completo
  - Telefone
  - Área aproximada (trabalhista, família, civil, criminal, etc.)
- Ao final, diga sempre que um advogado retornará o contato.

[Exemplo de saudação]
"Olá, seja bem-vindo(a) ao escritório de advocacia [NOME]! ⚖️
Sou a assistente virtual. Você poderia me explicar, de forma resumida, qual é a sua necessidade para que eu direcione ao advogado correto?"`
  },
  {
    id: "assistencia-tecnica",
    label: "Assistência Técnica",
    defaultName: "Atendimento - Assistência Técnica",
    prompt: `[Contexto]
Você é a atendente virtual de uma assistência técnica de eletrônicos/eletrodomésticos.

[Objetivo]
- Identificar o problema do equipamento;
- Informar sobre orçamento, prazos e retirada/entrega;
- Coletar dados para abertura de ordem de serviço.

[Regras]
- Pergunte sempre:
  - Tipo de equipamento
  - Marca/modelo
  - Descrição do defeito
- Explique que os valores definitivos só são informados após análise técnica.
- Encaminhe para um atendente humano quando o cliente quiser finalizar o serviço.

[Exemplo de saudação]
"Olá! Você entrou em contato com a Assistência Técnica [NOME] 🔧
Sou a assistente virtual. Qual aparelho apresentou problema e o que está acontecendo?"`
  },
  {
    id: "loja-eletronicos",
    label: "Lojas de Eletrônicos",
    defaultName: "Atendimento - Loja de Eletrônicos",
    prompt: `[Contexto]
Você é a atendente virtual de uma loja de eletrônicos e informática.

[Objetivo]
- Ajudar o cliente a escolher produtos (celulares, notebooks, acessórios, etc.);
- Explicar, de forma simples, diferenças entre modelos;
- Encaminhar para um atendente humano para fechamento da venda.

[Regras]
- Pergunte o uso principal do produto (trabalho, estudos, jogos, uso básico).
- Faça sugestões de forma clara, sem termos muito técnicos.
- Sempre que o cliente demonstrar interesse em comprar, diga que um atendente humano irá finalizar o pedido.

[Exemplo de saudação]
"Olá! Bem-vindo(a) à loja [NOME DA LOJA] 📱💻
Sou a assistente virtual. Você procura algum produto específico ou quer ajuda para escolher?"`
  },
  {
    id: "entrega-gas",
    label: "Entrega de Gás",
    defaultName: "Atendimento - Entrega de Gás",
    prompt: `[Contexto]
Você é a atendente virtual de uma empresa de entrega de gás de cozinha.

[Objetivo]
- Receber pedidos de botijão;
- Confirmar endereço e forma de pagamento;
- Informar prazos médios de entrega.

[Regras]
- Pergunte:
  - Nome do cliente
  - Endereço completo com ponto de referência
  - Quantidade de botijões
  - Forma de pagamento
- Seja sempre rápido e objetivo.
- Avise o cliente que o tempo de entrega é aproximado.

[Exemplo de saudação]
"Olá! Você falou com a entrega de gás [NOME] 🔥
Sou a assistente virtual. Me informa por favor seu endereço completo, forma de pagamento e quantos botijões você precisa?"`
  },
  {
    id: "contabilidade",
    label: "Contabilidade",
    defaultName: "Atendimento - Escritório de Contabilidade",
    prompt: `[Contexto]
Você é a atendente virtual de um escritório de contabilidade.

[Objetivo]
- Entender se o cliente é pessoa física ou jurídica;
- Saber qual serviço precisa (abertura de empresa, folha, impostos, MEI, etc.);
- Encaminhar para o contador responsável.

[Regras]
- Mantenha tom profissional e simples.
- Nunca dê orientação fiscal completa; apenas direções gerais.
- Peça:
  - Nome
  - Tipo de empresa (se tiver)
  - Cidade
  - Serviço desejado

[Exemplo de saudação]
"Olá! Seja bem-vindo(a) ao escritório de contabilidade [NOME] 📊
Sou a assistente virtual. Você é MEI, empresa ou pessoa física? Em que posso te ajudar hoje?"`
  },
  {
    id: "doceria",
    label: "Doceria",
    defaultName: "Atendimento - Doceria",
    prompt: `[Contexto]
Você é a atendente virtual de uma doceria/confeitaria.

[Objetivo]
- Ajudar o cliente a escolher doces, bolos, tortas e encomendas;
- Informar sabores, tamanhos, prazos e retirada/entrega.

[Regras]
- Use um tom leve e simpático.
- Pergunte se o pedido é para consumo diário ou para festa.
- Quando for encomenda de festa, peça:
  - Data do evento
  - Quantidade de pessoas
  - Tipo de bolo ou mesa de doces

[Exemplo de saudação]
"Olá! Bem-vindo(a) à doceria [NOME] 🍰🍫
Sou a assistente virtual. Você quer ver nosso cardápio de hoje ou fazer uma encomenda para alguma data especial?"`
  },
  {
    id: "cursos",
    label: "Cursos",
    defaultName: "Atendimento - Escola de Cursos",
    prompt: `[Contexto]
Você é a atendente virtual de uma escola de cursos presenciais e/ou online.

[Objetivo]
- Ajudar o aluno a:
  - Conhecer os cursos disponíveis;
  - Entender duração, certificação e forma de pagamento;
  - Fazer uma pré-matrícula para o time comercial finalizar.

[Regras]
- Pergunte qual área interessa (informática, idiomas, profissionalizantes, etc.).
- Explique de forma simples como funciona a matrícula.
- Ao final, registre:
  - Nome
  - Curso de interesse
  - Telefone
  - Melhor horário para contato

[Exemplo de saudação]
"Olá! Você falou com a escola de cursos [NOME] 🎓
Sou a assistente virtual. Em qual área você tem interesse: informática, idiomas ou outros cursos?"`
  }
];

// Lista de modelos suportados
const allowedModels = [
  "gpt-4.1-mini",
  "gpt-4o",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite" 
];

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    flexWrap: "wrap",
  },
  multFieldLine: {
    display: "flex",
    "& > *:not(:last-child)": {
      marginRight: theme.spacing(1),
    },
  },
  btnWrapper: {
    position: "relative",
  },
  buttonProgress: {
    color: green[500],
    position: "absolute",
    top: "50%",
    left: "50%",
    marginTop: -12,
    marginLeft: -12,
  },
  formControl: {
    margin: theme.spacing(1),
    minWidth: 120,
  },
}));

// Esquema de validação alinhado com o backend/front
const DialogflowSchema = Yup.object().shape({
  name: Yup.string()
    .min(5, "Muito curto!")
    .max(100, "Muito longo!")
    .required("Obrigatório"),
  prompt: Yup.string()
    .min(50, "Muito curto!")
    .required("Descreva o treinamento para Inteligência Artificial"),
  model: Yup.string()
    .oneOf(allowedModels, "Modelo inválido")
    .required("Informe o modelo"),
  maxTokens: Yup.number()
    .min(10, "Mínimo 10 tokens")
    .max(4096, "Máximo 4096 tokens")
    .required("Informe o número máximo de tokens"),
  temperature: Yup.number()
    .min(0, "Mínimo 0")
    .max(1, "Máximo 1")
    .required("Informe a temperatura"),
  apiKey: Yup.string().required("Informe a API Key"),
  maxMessages: Yup.number()
    .min(1, "Mínimo 1 mensagem")
    .max(50, "Máximo 50 mensagens")
    .required("Informe o número máximo de mensagens"),
  voice: Yup.string().when("model", {
    is: "gpt-4.1-mini",
    then: Yup.string().required("Informe o modo para Voz"),
    otherwise: Yup.string().notRequired(),
  }),
  voiceKey: Yup.string().notRequired(),
  voiceRegion: Yup.string().notRequired(),
  queueId: Yup.mixed().notRequired(),
});

const FlowBuilderOpenAIModal = ({ open, onSave, data, onUpdate, close }) => {
  const classes = useStyles();
  const isMounted = useRef(true);

  const initialState = {
    name: "",
    prompt: "",
    model: "gpt-4.1-mini",
    voice: "texto",
    voiceKey: "",
    voiceRegion: "",
    maxTokens: 100,
    temperature: 1,
    apiKey: "",
    maxMessages: 10,
    queueId: "",
  };

  const [showApiKey, setShowApiKey] = useState(false);
  const [integration, setIntegration] = useState(initialState);
  const [labels, setLabels] = useState({
    title: "Adicionar OpenAI/Gemini ao fluxo",
    btn: "Adicionar",
  });
  const [openPromptModels, setOpenPromptModels] = useState(false);

  // 🔹 Estado do teste de prompt
  const [testMessage, setTestMessage] = useState("");
  const [testLoading, setTestLoading] = useState(false);
  const [testResponse, setTestResponse] = useState("");
  const [testError, setTestError] = useState("");

  useEffect(() => {
    if (open === "edit") {
      setLabels({
        title: "Editar OpenAI/Gemini do fluxo",
        btn: "Salvar",
      });
      const typebotIntegration = data?.data?.typebotIntegration || {};
      setIntegration({
        ...initialState,
        ...typebotIntegration,
        model: allowedModels.includes(typebotIntegration.model)
          ? typebotIntegration.model
          : "gpt-4.1-mini",
      });
    } else if (open === "create") {
      setLabels({
        title: "Adicionar OpenAI/Gemini ao fluxo",
        btn: "Adicionar",
      });
      setIntegration(initialState);
    }

    return () => {
      isMounted.current = false;
    };
  }, [open, data]);

  const handleClose = () => {
    close(null);
  };

  const handleSavePrompt = (values, { setSubmitting }) => {
    const promptData = {
      ...values,
      voice: values.model === "gpt-4.1-mini" ? values.voice : "texto",
    };

    if (open === "edit") {
      onUpdate({
        ...data,
        data: { typebotIntegration: promptData },
      });
    } else if (open === "create") {
      promptData.projectName = promptData.name;
      onSave({
        typebotIntegration: promptData,
      });
    }
    handleClose();
    setSubmitting(false);
  };

  // 🔹 Chama backend para testar prompt
  const runPromptTest = async (values) => {
    setTestError("");
    setTestResponse("");

    if (!values.apiKey) {
      setTestError("Informe a API Key antes de testar.");
      return;
    }

    if (!values.prompt || values.prompt.length < 10) {
      setTestError("Defina um prompt antes de testar.");
      return;
    }

    if (!testMessage || testMessage.trim().length === 0) {
      setTestError("Digite uma mensagem de teste.");
      return;
    }

    try {
      setTestLoading(true);

      const { data } = await api.post("/ai/test-prompt", {
        model: values.model,
        apiKey: values.apiKey,
        prompt: values.prompt,
        message: testMessage,
        temperature: Number(values.temperature) || 1,
        maxTokens: Number(values.maxTokens) || 100,
      });

      setTestResponse(data.answer || "");
    } catch (err) {
      console.error(err);
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        "Erro ao testar o prompt. Verifique a API Key e o modelo.";
      setTestError(msg);
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <div className={classes.root}>
      <Dialog
        open={open === "create" || open === "edit"}
        onClose={handleClose}
        fullWidth
        maxWidth="md"
        scroll="paper"
      >
        <DialogTitle id="form-dialog-title">{labels.title}</DialogTitle>
        <Formik
          initialValues={integration}
          enableReinitialize={true}
          validationSchema={DialogflowSchema}
          onSubmit={handleSavePrompt}
        >
          {({ touched, errors, isSubmitting, values, setFieldValue }) => {
            const handleSelectPromptModel = (model) => {
              if (!values.name || values.name.trim() === "") {
                setFieldValue("name", model.defaultName);
              }
              setFieldValue("prompt", model.prompt);
              setOpenPromptModels(false);
            };

            return (
              <Form style={{ width: "100%" }}>
                <DialogContent dividers>
                  {/* Botão de modelos de prompt */}
                  <Button
                    variant="contained"
                    color="primary"
                    fullWidth
                    style={{ marginBottom: 16 }}
                    onClick={() => setOpenPromptModels(true)}
                  >
                    Modelos de Prompts
                  </Button>

                  <Field
                    as={TextField}
                    label={i18n.t("promptModal.form.name")}
                    name="name"
                    error={touched.name && Boolean(errors.name)}
                    helperText={touched.name && errors.name}
                    variant="outlined"
                    margin="dense"
                    fullWidth
                    required
                  />
                  <FormControl fullWidth margin="dense" variant="outlined">
                    <Field
                      as={TextField}
                      label={i18n.t("promptModal.form.apikey")}
                      name="apiKey"
                      type={showApiKey ? "text" : "password"}
                      error={touched.apiKey && Boolean(errors.apiKey)}
                      helperText={touched.apiKey && errors.apiKey}
                      variant="outlined"
                      margin="dense"
                      fullWidth
                      required
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              onClick={() => setShowApiKey(!showApiKey)}
                            >
                              {showApiKey ? <VisibilityOff /> : <Visibility />}
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                    />
                  </FormControl>
                  <Field
                    as={TextField}
                    label={i18n.t("promptModal.form.prompt")}
                    name="prompt"
                    error={touched.prompt && Boolean(errors.prompt)}
                    helperText={touched.prompt && errors.prompt}
                    variant="outlined"
                    margin="dense"
                    fullWidth
                    required
                    rows={10}
                    multiline
                  />
                  <div className={classes.multFieldLine}>
                    <FormControl
  fullWidth
  margin="dense"
  variant="outlined"
  error={touched.model && Boolean(errors.model)}
>
  <InputLabel>
    {i18n.t("promptModal.form.model")}
  </InputLabel>
  <Field
    as={Select}
    label={i18n.t("promptModal.form.model")}
    name="model"
    onChange={(e) => {
      setFieldValue("model", e.target.value);
      if (e.target.value !== "gpt-4.1-mini") {
        setFieldValue("voice", "texto");
      }
    }}
  >
    <MenuItem value="gpt-4.1-mini">GPT 4.1 Mini</MenuItem>
    <MenuItem value="gpt-4o">GPT 4o</MenuItem>
    <MenuItem value="gemini-2.0-flash">Gemini 2.0 Flash</MenuItem>
    <MenuItem value="gemini-2.0-flash-lite">
      Gemini 2.0 Flash Lite
    </MenuItem>
  </Field>

  {touched.model && errors.model && (
    <div style={{ color: "red", fontSize: "12px" }}>
      {errors.model}
    </div>
  )}
</FormControl>
                    <FormControl
                      fullWidth
                      margin="dense"
                      variant="outlined"
                      disabled={values.model !== "gpt-4.1-mini"}
                      error={touched.voice && Boolean(errors.voice)}
                    >
                      <InputLabel>
                        {i18n.t("promptModal.form.voice")}
                      </InputLabel>
                      <Field
                        as={Select}
                        label={i18n.t("promptModal.form.voice")}
                        name="voice"
                      >
                        <MenuItem value="texto">Texto</MenuItem>
                        <MenuItem value="pt-BR-FranciscaNeural">
                          Francisca
                        </MenuItem>
                        <MenuItem value="pt-BR-AntonioNeural">
                          Antônio
                        </MenuItem>
                        <MenuItem value="pt-BR-BrendaNeural">Brenda</MenuItem>
                        <MenuItem value="pt-BR-DonatoNeural">Donato</MenuItem>
                        <MenuItem value="pt-BR-ElzaNeural">Elza</MenuItem>
                        <MenuItem value="pt-BR-FabioNeural">Fábio</MenuItem>
                        <MenuItem value="pt-BR-GiovannaNeural">
                          Giovanna
                        </MenuItem>
                        <MenuItem value="pt-BR-HumbertoNeural">
                          Humberto
                        </MenuItem>
                        <MenuItem value="pt-BR-JulioNeural">Julio</MenuItem>
                        <MenuItem value="pt-BR-LeilaNeural">Leila</MenuItem>
                        <MenuItem value="pt-BR-LeticiaNeural">
                          Letícia
                        </MenuItem>
                        <MenuItem value="pt-BR-ManuelaNeural">
                          Manuela
                        </MenuItem>
                        <MenuItem value="pt-BR-NicolauNeural">
                          Nicolau
                        </MenuItem>
                        <MenuItem value="pt-BR-ValerioNeural">
                          Valério
                        </MenuItem>
                        <MenuItem value="pt-BR-YaraNeural">Yara</MenuItem>
                      </Field>
                      {touched.voice && errors.voice && (
                        <div style={{ color: "red", fontSize: "12px" }}>
                          {errors.voice}
                        </div>
                      )}
                    </FormControl>
                  </div>

                  {/* Fila para transferência */}
                  <div style={{ marginTop: 8, marginBottom: 8 }}>
                    <InputLabel shrink>
                      Fila para transferir atendimento (opcional)
                    </InputLabel>
                    <QueueSelectSingle
                      value={values.queueId}
                      onChange={(value) => setFieldValue("queueId", value)}
                    />
                    <span style={{ fontSize: 12, color: "#666" }}>
                      Quando o cliente pedir para falar com um atendente, a IA
                      irá transferir o ticket para esta fila.
                    </span>
                  </div>

                  <div className={classes.multFieldLine}>
                    <Field
                      as={TextField}
                      label={i18n.t("promptModal.form.voiceKey")}
                      name="voiceKey"
                      error={touched.voiceKey && Boolean(errors.voiceKey)}
                      helperText={touched.voiceKey && errors.voiceKey}
                      variant="outlined"
                      margin="dense"
                      fullWidth
                      disabled={values.model !== "gpt-4.1-mini"}
                    />
                    <Field
                      as={TextField}
                      label={i18n.t("promptModal.form.voiceRegion")}
                      name="voiceRegion"
                      error={
                        touched.voiceRegion && Boolean(errors.voiceRegion)
                      }
                      helperText={touched.voiceRegion && errors.voiceRegion}
                      variant="outlined"
                      margin="dense"
                      fullWidth
                      disabled={values.model !== "gpt-4.1-mini"}
                    />
                  </div>
                  <div className={classes.multFieldLine}>
                    <Field
                      as={TextField}
                      label={i18n.t("promptModal.form.temperature")}
                      name="temperature"
                      error={
                        touched.temperature && Boolean(errors.temperature)
                      }
                      helperText={touched.temperature && errors.temperature}
                      variant="outlined"
                      margin="dense"
                      fullWidth
                      type="number"
                      inputProps={{
                        step: "0.1",
                        min: "0",
                        max: "1",
                      }}
                    />
                    <Field
                      as={TextField}
                      label={i18n.t("promptModal.form.max_tokens")}
                      name="maxTokens"
                      error={touched.maxTokens && Boolean(errors.maxTokens)}
                      helperText={touched.maxTokens && errors.maxTokens}
                      variant="outlined"
                      margin="dense"
                      fullWidth
                      type="number"
                    />
                    <Field
                      as={TextField}
                      label={i18n.t("promptModal.form.max_messages")}
                      name="maxMessages"
                      error={
                        touched.maxMessages && Boolean(errors.maxMessages)
                      }
                      helperText={touched.maxMessages && errors.maxMessages}
                      variant="outlined"
                      margin="dense"
                      fullWidth
                      type="number"
                    />
                  </div>

                  {/* 🔹 BLOCO DE TESTE DO PROMPT */}
                  <div
                    style={{
                      marginTop: 16,
                      padding: 12,
                      borderRadius: 4,
                      border: "1px solid #ddd",
                      background: "#fafafa",
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 600,
                        marginBottom: 8,
                        fontSize: 14,
                      }}
                    >
                      Teste rápido do Prompt
                    </div>

                    <TextField
                      label="Mensagem de teste (como se fosse o cliente)"
                      variant="outlined"
                      margin="dense"
                      fullWidth
                      multiline
                      rows={3}
                      value={testMessage}
                      onChange={(e) => setTestMessage(e.target.value)}
                    />

                    <div style={{ marginTop: 8, display: "flex" }}>
                      <Button
                        variant="contained"
                        color="primary"
                        onClick={() => runPromptTest(values)}
                        disabled={testLoading}
                      >
                        {testLoading ? "Testando..." : "Testar Prompt"}
                      </Button>
                      <span
                        style={{
                          marginLeft: 12,
                          fontSize: 11,
                          color: "#777",
                          alignSelf: "center",
                        }}
                      >
                        O teste usa a API Key informada acima e consome tokens
                        reais da sua conta.
                      </span>
                    </div>

                    {testError && (
                      <div
                        style={{
                          marginTop: 8,
                          color: "#d32f2f",
                          fontSize: 12,
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {testError}
                      </div>
                    )}

                    {testResponse && (
                      <div
                        style={{
                          marginTop: 8,
                          maxHeight: 220,
                          overflowY: "auto",
                          background: "#ffffff",
                          borderRadius: 4,
                          padding: 8,
                          border: "1px solid #e0e0e0",
                          fontSize: 13,
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {testResponse}
                      </div>
                    )}
                  </div>
                  {/* 🔹 FIM BLOCO DE TESTE */}
                </DialogContent>

                {/* 🔹 MODAL DOS MODELOS DE PROMPT */}
                <Dialog
                  open={openPromptModels}
                  onClose={() => setOpenPromptModels(false)}
                  maxWidth="sm"
                  fullWidth
                >
                  <DialogTitle>Selecione o Modelo</DialogTitle>
                  <DialogContent dividers>
                    <Grid container spacing={2}>
                      {PROMPT_MODELS.map((model) => (
                        <Grid item xs={6} key={model.id}>
                          <Button
                            variant="contained"
                            color="primary"
                            fullWidth
                            onClick={() => handleSelectPromptModel(model)}
                          >
                            {model.label}
                          </Button>
                        </Grid>
                      ))}
                    </Grid>
                  </DialogContent>
                  <DialogActions>
                    <Button
                      onClick={() => setOpenPromptModels(false)}
                      color="secondary"
                    >
                      Fechar
                    </Button>
                  </DialogActions>
                </Dialog>

                <DialogActions>
                  <Button
                    onClick={handleClose}
                    color="secondary"
                    variant="outlined"
                    disabled={isSubmitting}
                  >
                    {i18n.t("promptModal.buttons.cancel")}
                  </Button>
                  <Button
                    type="submit"
                    color="primary"
                    variant="contained"
                    className={classes.btnWrapper}
                    disabled={isSubmitting}
                  >
                    {labels.btn}
                  </Button>
                </DialogActions>
              </Form>
            );
          }}
        </Formik>
      </Dialog>
    </div>
  );
};

export default FlowBuilderOpenAIModal;
