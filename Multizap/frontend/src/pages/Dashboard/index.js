import React, { useContext, useState, useEffect } from "react";
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Avatar,
  Paper,
  Stack,
  SvgIcon,
  Tab,
  Tabs,
  Grid,
  IconButton,
  Divider,
  Chip,
  Skeleton,
  Tooltip as MuiTooltip
} from "@mui/material";
import {
  SaveAlt,
  Groups,
  Call as CallIcon,
  HourglassEmpty as HourglassEmptyIcon,
  CheckCircle as CheckCircleIcon,
  RecordVoiceOver as RecordVoiceOverIcon,
  GroupAdd as GroupAddIcon,
  Star,
  CalendarMonth,
  Refresh
} from "@mui/icons-material";
import * as XLSX from "xlsx";
import { toast } from "react-toastify";
import { isArray } from "lodash";

// ✅ caminhos corretos do seu projeto
import { AuthContext } from "../../context/Auth/AuthContext";
import { i18n } from "../../translate/i18n";
import ForbiddenPage from "../../components/ForbiddenPage";
import TableAttendantsStatus from "../../components/Dashboard/TableAttendantsStatus";
import api from "../../services/api";

// ✅ arquivos locais do dashboard (na mesma pasta)
import { ChatsUser } from "./ChartsUser";
import ChartDonut from "./ChartDonut";
import { ChartsDate } from "./ChartsDate";

// Tema v4 (whitelabel igual ao login) + tema v5 para demais tokens
import { useTheme as useThemeV4 } from "@material-ui/core/styles";
import { useTheme as useThemeV5, alpha } from "@mui/material/styles";

const StatCard = ({ title, value, icon, color, loading }) => {
  const safeColor = color || "#1976d2";

  return (
    <Card
      sx={{
        height: "100%",
        borderRadius: 3,
        position: "relative",
        overflow: "hidden",
        border: "1px solid",
        borderColor: "divider",
        background: theme =>
          `linear-gradient(180deg, ${alpha(theme.palette.background.paper, 0.9)}, ${theme.palette.background.paper})`,
        boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
        transition: "transform 0.18s ease, box-shadow 0.18s ease",
        "&:hover": {
          transform: "translateY(-4px)",
          boxShadow: "0 18px 44px rgba(0,0,0,0.12)"
        },
        "&::before": {
          content: '""',
          position: "absolute",
          inset: 0,
          background: `radial-gradient(600px 280px at 0% 0%, ${alpha(
            safeColor,
            0.18
          )}, transparent 60%)`,
          pointerEvents: "none"
        },
        "&::after": {
          content: '""',
          position: "absolute",
          left: 0,
          top: 0,
          height: 4,
          width: "100%",
          background: `linear-gradient(90deg, ${safeColor}, ${alpha(
            safeColor,
            0.25
          )})`,
          pointerEvents: "none"
        }
      }}
    >
      <CardContent sx={{ pt: 2.6 }}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          spacing={1.5}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="overline"
              sx={{
                fontWeight: 900,
                color: "text.secondary",
                letterSpacing: 0.8
              }}
            >
              {loading ? <Skeleton width={120} /> : title}
            </Typography>

            <Typography variant="h4" sx={{ fontWeight: 950, lineHeight: 1.1 }}>
              {loading ? <Skeleton width={90} /> : value}
            </Typography>
          </Box>

          <Avatar
            sx={{
              bgcolor: alpha(safeColor, 0.14),
              color: safeColor,
              width: 56,
              height: 56,
              border: `1px solid ${alpha(safeColor, 0.25)}`,
              boxShadow: `0 16px 30px ${alpha(safeColor, 0.25)}`
            }}
          >
            <SvgIcon sx={{ fontSize: 30 }}>{icon}</SvgIcon>
          </Avatar>
        </Stack>
      </CardContent>
    </Card>
  );
};

const NpsMetricCard = ({ title, value, color }) => {
  const v = Number.isFinite(Number(value)) ? Number(value) : 0;
  const clamped = Math.max(0, Math.min(100, v));

  return (
    <Grid item xs={12} md={4}>
      <Card
        sx={{
          height: "100%",
          textAlign: "center",
          p: 2,
          borderRadius: 3,
          border: "1px solid",
          borderColor: "divider",
          background: theme =>
            `linear-gradient(180deg, ${alpha(theme.palette.background.paper, 0.9)}, ${theme.palette.background.paper})`,
          boxShadow: "0 10px 30px rgba(0,0,0,0.08)"
        }}
      >
        <Typography
          variant="overline"
          sx={{
            fontWeight: 900,
            letterSpacing: 0.8,
            color: "text.secondary"
          }}
        >
          {title}
        </Typography>

        <Typography variant="h3" sx={{ fontWeight: 950, color, my: 1 }}>
          {clamped}%
        </Typography>

        <Box
          sx={{
            height: 10,
            backgroundColor: "grey.200",
            borderRadius: 2,
            overflow: "hidden"
          }}
        >
          <Box
            sx={{
              height: "100%",
              width: `${clamped}%`,
              backgroundColor: color
            }}
          />
        </Box>
      </Card>
    </Grid>
  );
};

const Dashboard = () => {
  const themeV5 = useThemeV5();
  const themeV4 = useThemeV4();

  const PRIMARY_MAIN = themeV4?.palette?.primary?.main || "#1976d2";
  const PRIMARY_DARK = themeV4?.palette?.primary?.dark || "#115293";
  const PRIMARY_CONTRAST = themeV4?.palette?.primary?.contrastText || "#fff";

  const [counters, setCounters] = useState({});
  const [attendants, setAttendants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [lastUpdate, setLastUpdate] = useState(null);

  const { user } = useContext(AuthContext);

  const dateFrom = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1
  ).toISOString().slice(0, 10);

  const dateTo = new Date().toISOString().slice(0, 10);

  // ✅ Busca direto do backend (sem hook inexistente)
  const fetchDashboard = async params => {
    const { data } = await api.get("/dashboard", { params });
    return data;
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = { date_from: dateFrom, date_to: dateTo };

      const data = await fetchDashboard(params);

      // data.counters + data.attendants (padrão do dashboard)
      setCounters(data?.counters || {});
      if (isArray(data?.attendants)) setAttendants(data.attendants);
      else setAttendants([]);

      setLastUpdate(new Date());
    } catch (error) {
      toast.error("Não foi possível carregar os dados do dashboard.");
      // eslint-disable-next-line no-console
      console.error(error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exportToExcel = () => {
    try {
      const table = document.getElementById("grid-attendants");
      const ws = XLSX.utils.table_to_sheet(table);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "RelatorioDeAtendentes");
      XLSX.writeFile(wb, "relatorio-de-atendentes.xlsx");
    } catch {
      toast.error("Erro ao exportar para Excel.");
    }
  };

  const getOnlineUsersCount = () => attendants.filter(u => u.online).length;

  if (user?.profile === "user" && user?.showDashboard === "disabled") {
    return <ForbiddenPage />;
  }

  const statCards = [
    {
      title: i18n.t("dashboard.cards.inAttendance"),
      value: counters.supportHappening || 0,
      icon: <CallIcon />,
      color: PRIMARY_MAIN
    },
    {
      title: i18n.t("dashboard.cards.waiting"),
      value: counters.supportPending || 0,
      icon: <HourglassEmptyIcon />,
      color: themeV5.palette.info.main
    },
    {
      title: i18n.t("dashboard.cards.finalized"),
      value: counters.supportFinished || 0,
      icon: <CheckCircleIcon />,
      color: themeV5.palette.success.main
    },
    {
      title: i18n.t("dashboard.cards.groups"),
      value: counters.supportGroups || 0,
      icon: <Groups />,
      color: themeV5.palette.secondary.main
    },
    {
      title: i18n.t("dashboard.cards.activeAttendants"),
      value: `${getOnlineUsersCount()}/${attendants.length}`,
      icon: <RecordVoiceOverIcon />,
      color: themeV5.palette.error.main
    },
    {
      title: i18n.t("dashboard.cards.newContacts"),
      value: counters.leads || 0,
      icon: <GroupAddIcon />,
      color: themeV5.palette.warning.main
    }
  ];

  const npsData = {
    score: counters.npsScore || 0,
    promoters: counters.npsPromotersPerc || 0,
    passives: counters.npsPassivePerc || 0,
    detractors: counters.npsDetractorsPerc || 0,
    totalTickets: counters.tickets || 0,
    withRating: counters.withRating || 0,
    percRating: counters.percRating || 0
  };

  const npsColors = {
    Promotores: "#2EA85A",
    Detratores: "#F73A2C",
    Neutros: "#F7EC2C"
  };

  const npsChartData = [
    { name: "Promotores", value: npsData.promoters },
    { name: "Detratores", value: npsData.detractors },
    { name: "Neutros", value: npsData.passives }
  ].sort((a, b) => a.name.localeCompare(b.name));

  const sortedNpsColors = npsChartData.map(item => npsColors[item.name]);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        py: { xs: 2, sm: 3, md: 4 },
        background: `radial-gradient(900px 420px at 15% 0%, ${alpha(
          PRIMARY_MAIN,
          0.12
        )}, transparent 60%),
                     radial-gradient(700px 360px at 85% 20%, ${alpha(
          themeV5.palette.secondary.main,
          0.1
        )}, transparent 65%),
                     ${themeV5.palette.background.default}`
      }}
    >
      <Container maxWidth="xl">
        {/* Header premium */}
        <Paper
          elevation={0}
          sx={{
            mb: 3,
            p: { xs: 2, sm: 2.5 },
            borderRadius: 3,
            border: "1px solid",
            borderColor: "divider",
            background: alpha(themeV5.palette.background.paper, 0.7),
            backdropFilter: "blur(12px)",
            boxShadow: "0 10px 30px rgba(0,0,0,0.10)"
          }}
        >
          <Box
            sx={{
              display: "flex",
              flexDirection: { xs: "column", md: "row" },
              alignItems: { xs: "flex-start", md: "center" },
              justifyContent: "space-between",
              gap: 2
            }}
          >
            <Box>
              <Typography variant="h4" fontWeight={950} sx={{ letterSpacing: -0.6 }}>
                {i18n.t("dashboard.title") || "Dashboard"}
              </Typography>

              <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
                Visão geral do atendimento, desempenho e avaliações
              </Typography>

              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                {lastUpdate ? `Atualizado: ${lastUpdate.toLocaleString()}` : "Atualizando..."}
              </Typography>
            </Box>

            <Stack direction="row" spacing={1} alignItems="center">
              <Chip
                icon={<CalendarMonth />}
                label={`${dateFrom} → ${dateTo}`}
                sx={{
                  bgcolor: alpha(PRIMARY_MAIN, 0.10),
                  color: PRIMARY_MAIN,
                  fontWeight: 900,
                  border: `1px solid ${alpha(PRIMARY_MAIN, 0.18)}`
                }}
              />

              <MuiTooltip title="Atualizar dados">
                <IconButton
                  onClick={fetchData}
                  size="small"
                  sx={{
                    borderRadius: 2,
                    border: `1px solid ${alpha(PRIMARY_MAIN, 0.25)}`,
                    bgcolor: alpha(PRIMARY_MAIN, 0.08),
                    color: PRIMARY_MAIN,
                    "&:hover": { bgcolor: alpha(PRIMARY_MAIN, 0.14) }
                  }}
                >
                  <Refresh fontSize="small" />
                </IconButton>
              </MuiTooltip>
            </Stack>
          </Box>
        </Paper>

        {/* Cards */}
        <Grid container spacing={2.5} sx={{ mb: 3 }}>
          {statCards.map((card, index) => (
            <Grid item xs={12} sm={6} md={4} lg={2} key={index}>
              <StatCard {...card} loading={loading} />
            </Grid>
          ))}
        </Grid>

        {/* Tabs premium */}
        <Paper
          elevation={0}
          sx={{
            mb: 2.5,
            borderRadius: 3,
            border: "1px solid",
            borderColor: "divider",
            bgcolor: alpha(themeV5.palette.background.paper, 0.72),
            backdropFilter: "blur(10px)"
          }}
        >
          <Tabs
            value={activeTab}
            onChange={(e, nv) => setActiveTab(nv)}
            variant="fullWidth"
            sx={{
              "& .MuiTab-root": {
                py: 1.6,
                fontWeight: 950,
                textTransform: "uppercase",
                letterSpacing: 0.9,
                fontSize: "0.90rem",
                color: "text.secondary",
                "&.Mui-selected": { color: PRIMARY_MAIN }
              },
              "& .MuiTabs-indicator": {
                backgroundColor: PRIMARY_MAIN,
                height: 4,
                borderRadius: "4px"
              }
            }}
          >
            <Tab label={i18n.t("dashboard.tabs.performance")} />
            <Tab label="NPS" />
            <Tab label={i18n.t("dashboard.tabs.attendants")} />
          </Tabs>
        </Paper>

        {/* Conteúdo */}
        <Box>
          {activeTab === 0 && (
            <Paper
              elevation={0}
              sx={{
                p: { xs: 2, sm: 3 },
                borderRadius: 3,
                border: "1px solid",
                borderColor: "divider",
                background: alpha(themeV5.palette.background.paper, 0.75),
                backdropFilter: "blur(10px)",
                boxShadow: "0 18px 44px rgba(0,0,0,0.12)"
              }}
            >
              {loading ? (
                <Box>
                  <Skeleton height={28} width={260} />
                  <Skeleton height={18} width={200} />
                  <Box sx={{ mt: 2 }}>
                    <Skeleton height={380} />
                  </Box>
                </Box>
              ) : (
                <ChartsDate />
              )}
            </Paper>
          )}

          {activeTab === 1 && (
            <Paper
              elevation={0}
              sx={{
                p: { xs: 2, sm: 3 },
                borderRadius: 3,
                border: "1px solid",
                borderColor: "divider",
                background: alpha(themeV5.palette.background.paper, 0.75),
                backdropFilter: "blur(10px)",
                boxShadow: "0 18px 44px rgba(0,0,0,0.12)"
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                <Avatar
                  sx={{
                    bgcolor: alpha(PRIMARY_MAIN, 0.12),
                    color: PRIMARY_MAIN,
                    mr: 2,
                    border: `1px solid ${alpha(PRIMARY_MAIN, 0.25)}`
                  }}
                >
                  <Star />
                </Avatar>
                <Box>
                  <Typography variant="h6" fontWeight={950}>
                    {i18n.t("dashboard.tabs.assessments")}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Qualidade percebida no atendimento (promotores, neutros e detratores)
                  </Typography>
                </Box>
              </Box>

              <Divider sx={{ my: 2 }} />

              <Grid container spacing={2.5}>
                <Grid item xs={12} md={4}>
                  <Card
                    sx={{
                      height: "100%",
                      p: 2,
                      borderRadius: 3,
                      border: "1px solid",
                      borderColor: "divider",
                      background: theme =>
                        `linear-gradient(180deg, ${alpha(
                          theme.palette.background.paper,
                          0.9
                        )}, ${theme.palette.background.paper})`,
                      boxShadow: "0 10px 30px rgba(0,0,0,0.08)"
                    }}
                  >
                    <Typography
                      variant="overline"
                      sx={{
                        fontWeight: 900,
                        color: "text.secondary",
                        letterSpacing: 0.8
                      }}
                    >
                      NPS Score Geral
                    </Typography>

                    <Box sx={{ mt: 1 }}>
                      <ChartDonut
                        data={npsChartData}
                        value={npsData.score}
                        colors={sortedNpsColors}
                      />
                    </Box>
                  </Card>
                </Grid>

                <Grid item xs={12} md={8}>
                  <Grid container spacing={2}>
                    <NpsMetricCard
                      title={i18n.t("dashboard.assessments.prosecutors")}
                      value={npsData.promoters}
                      color={npsColors["Promotores"]}
                    />
                    <NpsMetricCard
                      title={i18n.t("dashboard.assessments.neutral")}
                      value={npsData.passives}
                      color={npsColors["Neutros"]}
                    />
                    <NpsMetricCard
                      title={i18n.t("dashboard.assessments.detractors")}
                      value={npsData.detractors}
                      color={npsColors["Detratores"]}
                    />
                  </Grid>
                </Grid>

                <Grid item xs={12} mt={0.5}>
                  <Paper
                    variant="outlined"
                    sx={{
                      borderRadius: 3,
                      bgcolor: alpha(themeV5.palette.background.paper, 0.55),
                      backdropFilter: "blur(8px)"
                    }}
                  >
                    <Grid container textAlign="center">
                      {[
                        {
                          title: i18n.t("dashboard.assessments.totalCalls"),
                          value: npsData.totalTickets
                        },
                        {
                          title: i18n.t("dashboard.assessments.ratedCalls"),
                          value: npsData.withRating
                        },
                        {
                          title: i18n.t("dashboard.assessments.evaluationIndex"),
                          value: `${Number(npsData.percRating || 0).toFixed(1)}%`
                        }
                      ].map((item, index) => (
                        <Grid
                          item
                          xs={12}
                          sm={4}
                          key={item.title}
                          sx={{ p: 2.2, position: "relative" }}
                        >
                          <Typography
                            variant="body2"
                            sx={{ color: "text.secondary", fontWeight: 800 }}
                            gutterBottom
                          >
                            {item.title}
                          </Typography>
                          <Typography
                            variant="h5"
                            fontWeight={950}
                            sx={{ color: PRIMARY_MAIN }}
                          >
                            {item.value}
                          </Typography>

                          {index < 2 && (
                            <Divider
                              orientation="vertical"
                              flexItem
                              sx={{
                                position: "absolute",
                                right: 0,
                                top: "18%",
                                height: "64%",
                                display: { xs: "none", sm: "block" }
                              }}
                            />
                          )}
                        </Grid>
                      ))}
                    </Grid>
                  </Paper>
                </Grid>
              </Grid>
            </Paper>
          )}

          {activeTab === 2 && (
            <Paper
              elevation={0}
              sx={{
                p: { xs: 2, sm: 3 },
                borderRadius: 3,
                border: "1px solid",
                borderColor: "divider",
                background: alpha(themeV5.palette.background.paper, 0.75),
                backdropFilter: "blur(10px)",
                boxShadow: "0 18px 44px rgba(0,0,0,0.12)"
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  mb: 2
                }}
              >
                <Box>
                  <Typography variant="h6" fontWeight={950}>
                    {i18n.t("dashboard.tabs.attendants")}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Status e produtividade dos atendentes
                  </Typography>
                </Box>

                <MuiTooltip title="Exportar Excel">
                  <IconButton
                    onClick={exportToExcel}
                    size="small"
                    sx={{
                      backgroundColor: PRIMARY_MAIN,
                      color: PRIMARY_CONTRAST,
                      transition: "all .2s ease-in-out",
                      borderRadius: 2,
                      "&:hover": {
                        backgroundColor: PRIMARY_DARK,
                        transform: "translateY(-1px)",
                        boxShadow: "0 6px 18px rgba(0,0,0,.15)"
                      }
                    }}
                  >
                    <SaveAlt />
                  </IconButton>
                </MuiTooltip>
              </Box>

              <Divider sx={{ mb: 3 }} />

              <div id="grid-attendants">
                {loading ? (
                  <Box>
                    <Skeleton height={44} />
                    <Skeleton height={44} />
                    <Skeleton height={44} />
                    <Skeleton height={44} />
                  </Box>
                ) : attendants.length > 0 ? (
                  <TableAttendantsStatus attendants={attendants} loading={loading} />
                ) : (
                  <Typography color="text.secondary">
                    Nenhum atendente encontrado.
                  </Typography>
                )}
              </div>

              <Box sx={{ mt: 4 }}>
                <ChatsUser />
              </Box>
            </Paper>
          )}
        </Box>
      </Container>
    </Box>
  );
};

export default Dashboard;
