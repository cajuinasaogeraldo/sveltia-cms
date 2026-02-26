/**
 * Brazilian Portuguese translation for Sveltia CMS.
 */
export const strings = {
  // Pages & Navigation
  collections: 'Coleções',
  contents: 'Conteúdos',
  entries: 'Entradas',
  files: 'Arquivos',
  assets: 'Recursos',
  media: 'Mídia',
  workflow: 'Fluxo de Trabalho',
  editorial_workflow: 'Fluxo Editorial',
  menu: 'Menu',

  // Account
  user_name: 'Nome de Usuário',
  password: 'Senha',
  sign_in: 'Entrar',
  sign_in_with_mobile: 'Entrar com Celular',
  sign_in_with_mobile_instruction:
    'Escaneie o código QR abaixo com seu telefone ou tablet para entrar sem senha. Suas configurações serão copiadas automaticamente.',
  signed_in_as_x: 'Conectado como {name}',
  working_with_local_repo: 'Trabalhando com Repositório Local',
  working_with_test_repo: 'Trabalhando com Repositório de Teste',
  sign_out: 'Sair',

  // Common terms
  create: 'Novo',
  select: 'Selecionar',
  select_all: 'Selecionar Tudo',
  upload: 'Enviar',
  copy: 'Copiar',
  download: 'Baixar',
  deploy: 'Deploy',
  deploying: 'Fazendo deploy',
  deploy_status: 'Status do Deploy',
  deploy_site: 'Deploys do Site',
  deploy_successful: 'Deploy bem-sucedido',
  deploy_failed: 'Deploy falhou',
  deploy_cancelled: 'Deploy cancelado',
  deploy_build_complete: 'Deploy concluído com sucesso!',
  deploy_build_failed: 'Deploy falhou. Verifique os logs para detalhes.',
  deploying_site: 'Fazendo deploy do site...',
  in_progress: 'Em andamento',
  no_recent_deploys: 'Nenhum deploy recente',
  duplicate: 'Duplicar',
  delete: 'Excluir',
  save: 'Salvar',
  saving: 'Salvando…',
  save_draft: 'Salvar Rascunho',
  saving_draft: 'Salvando Rascunho…',
  rename: 'Renomear',
  update: 'Atualizar',
  replace: 'Substituir',
  add: 'Adicionar',
  remove: 'Remover',
  remove_x: 'Remover {name}',
  clear: 'Limpar',
  expand: 'Expandir',
  expand_all: 'Expandir Tudo',
  collapse: 'Recolher',
  collapse_all: 'Recolher Tudo',
  insert: 'Inserir',
  restore: 'Restaurar',
  discard: 'Descartar',
  searching: 'Pesquisando…',
  no_results: 'Nenhum resultado encontrado.',
  ok: 'OK',
  global: 'Global',
  primary: 'Principal',
  secondary: 'Secundário',
  collection: 'Coleção',
  folder: 'Pasta',
  api_key: 'Chave da API',
  details: 'Detalhes',
  back: 'Voltar',
  cancel: 'Cancelar',
  confirm: 'Confirmar',
  loading: 'Carregando…',
  later: 'Mais Tarde',
  slug: 'Slug',
  singleton: 'Singleton',
  singletons: 'Singletons',

  // Common errors
  clipboard_error: 'Ocorreu um erro ao copiar os dados.',

  // Entrance
  welcome_to_sveltia_cms: 'Bem-vindo ao Sveltia CMS',
  loading_cms_config: 'Carregando Configuração do CMS…',
  loading_site_data: 'Carregando Dados do Site…',
  loading_site_data_error: 'Ocorreu um erro ao carregar os dados do site.',
  sign_in_with_x: 'Entrar com {service}',
  sign_in_with_x_using_pat: 'Entrar com {service} Usando PAT',
  sign_in_using_pat_title: 'Entrar Usando Token de Acesso Pessoal',
  sign_in_using_pat_description:
    'Digite seu token abaixo. Ele deve ter acesso de leitura/escrita ao conteúdo do repositório.',
  sign_in_using_pat_link:
    'Você pode gerar um token na <a>página de configurações de usuário do {service}</a>.',
  personal_access_token: 'Token de Acesso Pessoal',
  authorizing: 'Autorizando…',
  signing_in: 'Entrando…',
  work_with_local_repo: 'Trabalhar com Repositório Local',
  work_with_local_repo_description:
    'Quando solicitado, selecione o diretório raiz do repositório "{repo}".',
  work_with_local_repo_description_no_repo:
    'Quando solicitado, selecione o diretório raiz do seu repositório Git.',
  work_with_test_repo: 'Trabalhar com Repositório de Teste',
  sign_in_error: {
    not_project_root:
      'A pasta selecionada não é um diretório raiz de repositório. Por favor, tente novamente.',
    picker_dismissed:
      'Não foi possível selecionar um diretório raiz de repositório. Por favor, tente novamente.',
    authentication_aborted: 'Autenticação cancelada. Por favor, tente novamente.',
    invalid_token: 'O token fornecido é inválido. Por favor, verifique e tente novamente.',
    // Errors defined in Sveltia CMS Authenticator
    // https://github.com/sveltia/sveltia-cms-auth/blob/main/src/index.js
    UNSUPPORTED_BACKEND: 'Seu backend Git não é suportado pelo autenticador.',
    UNSUPPORTED_DOMAIN: 'Seu domínio não está autorizado a usar o autenticador.',
    MISCONFIGURED_CLIENT: 'ID do cliente ou segredo do aplicativo OAuth não está configurado.',
    AUTH_CODE_REQUEST_FAILED:
      'Falha ao receber um código de autorização. Por favor, tente novamente mais tarde.',
    CSRF_DETECTED: 'Potencial ataque CSRF detectado. Fluxo de autenticação abortado.',
    TOKEN_REQUEST_FAILED:
      'Falha ao solicitar um token de acesso. Por favor, tente novamente mais tarde.',
    TOKEN_REFRESH_FAILED:
      'Falha ao atualizar o token de acesso. Por favor, tente novamente mais tarde.',
    MALFORMED_RESPONSE:
      'Servidor respondeu com dados malformados. Por favor, tente novamente mais tarde.',
  },
  backend_unsupported_version: 'O backend {name} requer {name} {version} ou posterior.',
  repository_no_access: 'Você não tem acesso ao repositório "{repo}".',
  repository_not_found: 'O repositório "{repo}" não existe.',
  repository_empty: 'O repositório "{repo}" não possui branches.',
  branch_not_found: 'O repositório "{repo}" não possui o branch "{branch}".',
  unexpected_error: 'Erro Inesperado',

  // Parser errors
  entry_parse_error:
    'Ocorreu um erro ao analisar um arquivo de entrada. Verifique o console do navegador para detalhes.',
  entry_parse_errors:
    'Ocorreram erros ao analisar arquivos de entrada. Verifique o console do navegador para detalhes.',

  // Onboarding
  mobile_promo_title: 'Sveltia CMS agora está disponível no celular!',
  mobile_promo_button: 'Experimente',

  // Global toolbar
  visit_live_site: 'Visitar Site ao Vivo',
  switch_page: 'Trocar Página',
  search_placeholder_entries: 'Pesquisar entradas…',
  search_placeholder_assets: 'Pesquisar recursos…',
  search_placeholder_all: 'Pesquisar entradas e recursos…',
  create_entry_or_assets: 'Criar Entrada ou Recursos',
  publish_changes: 'Publicar Alterações',
  publishing_changes: 'Publicando Alterações…',
  publishing_changes_failed:
    'Não foi possível publicar as alterações. Por favor, tente novamente mais tarde.',
  show_notifications: 'Mostrar Notificações',
  notifications: 'Notificações',
  show_account_menu: 'Mostrar Menu da Conta',
  account: 'Conta',
  live_site: 'Site ao Vivo',
  git_repository: 'Repositório Git',
  settings: 'Configurações',
  cms_config: 'Configuração do CMS',
  show_help_menu: 'Mostrar Menu de Ajuda',
  help: 'Ajuda',
  keyboard_shortcuts: 'Atalhos de Teclado',
  documentation: 'Documentação',
  release_notes: 'Notas de Versão',
  version_x: 'Versão {version}',
  report_issue: 'Reportar Problema',
  share_feedback: 'Compartilhar Feedback',
  get_help: 'Obter Ajuda',
  join_discord: 'Junte-se a Nós no Discord',

  // Update notification
  update_available: 'A versão mais recente do Sveltia CMS está disponível.',
  update_now: 'Atualizar Agora',

  // Backend status indicator
  backend_status: {
    minor_incident:
      '{service} está enfrentando um incidente menor. Seu fluxo de trabalho pode ser potencialmente afetado.',
    major_incident:
      '{service} está enfrentando um incidente grave. Você pode querer aguardar até que a situação melhore.',
  },

  // Library
  content_library: 'Biblioteca de Conteúdo',
  asset_library: 'Biblioteca de Recursos',
  asset_location: {
    repository: 'Seu Site',
    external: 'Locais Externos',
    stock_photos: 'Fotos de Banco',
  },
  collection_assets: 'Recursos da Coleção',
  entry_list: 'Lista de Entradas',
  file_list: 'Lista de Arquivos',
  asset_list: 'Lista de Recursos',
  x_collection: 'Coleção "{collection}"',
  x_asset_folder: 'Pasta de Recursos "{folder}"',
  viewing_collection_list: 'Você está visualizando a lista de coleções.',
  viewing_asset_folder_list: 'Você está visualizando a lista de pastas de recursos.',
  viewing_x_collection_many_entries:
    'Você está visualizando a coleção "{collection}", que possui {count} entradas.',
  viewing_x_collection_one_entry:
    'Você está visualizando a coleção "{collection}", que possui uma entrada.',
  viewing_x_collection_no_entries:
    'Você está visualizando a coleção "{collection}", que ainda não possui entradas.',
  viewing_x_asset_folder_many_assets:
    'Você está visualizando a pasta de recursos "{folder}", que possui {count} recursos.',
  viewing_x_asset_folder_one_asset:
    'Você está visualizando a pasta de recursos "{folder}", que possui um recurso.',
  viewing_x_asset_folder_no_assets:
    'Você está visualizando a pasta de recursos "{folder}", que ainda não possui recursos.',
  singleton_selected_announcement: 'Pressione Enter para editar o arquivo "{file}".',
  collection_not_found: 'Coleção não encontrada',
  file_not_found: 'Arquivo não encontrado.',
  x_of_x_selected: '{selected} de {total} selecionados',
  switch_view: 'Trocar Visualização',
  list_view: 'Visualização em Lista',
  grid_view: 'Visualização em Grade',
  switch_to_list_view: 'Mudar para Visualização em Lista',
  switch_to_grid_view: 'Mudar para Visualização em Grade',
  sort: 'Ordenar',
  sorting_options: 'Opções de Ordenação',
  sort_keys: {
    none: 'Nenhuma',
    name: 'Nome',
    slug: 'Slug',
    commit_author: 'Atualizado por',
    commit_date: 'Atualizado em',
  },
  ascending: '{label}, A a Z',
  ascending_date: '{label}, mais antigo para mais recente',
  descending: '{label}, Z a A',
  descending_date: '{label}, mais recente para mais antigo',
  filter: 'Filtrar',
  filtering_options: 'Opções de Filtragem',
  group: 'Agrupar',
  grouping_options: 'Opções de Agrupamento',
  type: 'Tipo',
  all: 'Todos',
  image: 'Imagem',
  video: 'Vídeo',
  audio: 'Áudio',
  document: 'Documento',
  other: 'Outro',
  show_assets: 'Mostrar Recursos',
  hide_assets: 'Ocultar Recursos',
  show_info: 'Mostrar Info',
  hide_info: 'Ocultar Info',
  all_assets: 'Todos os Recursos',
  global_assets: 'Recursos Globais',
  entry_not_found: 'Entrada não encontrada.',
  creating_entries_disabled_by_admin:
    'A criação de novas entradas nesta coleção está desabilitada pelo administrador.',
  creating_entries_disabled_by_limit:
    'Você não pode adicionar novas entradas a esta coleção porque ela atingiu seu limite de {limit} entradas.',
  back_to_collection: 'Voltar para Coleção',
  collection_list: 'Lista de Coleções',
  back_to_collection_list: 'Voltar para Lista de Coleções',
  asset_folder_list: 'Lista de Pastas de Recursos',
  back_to_asset_folder_list: 'Voltar para Lista de Pastas de Recursos',
  search_results: 'Resultados da Pesquisa',
  search_results_for_x: 'Resultados da Pesquisa para "{terms}"',
  viewing_entry_search_results:
    'Você está visualizando os resultados da pesquisa para "{terms}". Encontramos {entries}.',
  viewing_asset_search_results:
    'Você está visualizando os resultados da pesquisa para "{terms}". Encontramos {assets}.',
  many_entries: '{count} entradas',
  one_entry: 'uma entrada',
  no_entries: 'nenhuma entrada',
  many_assets: '{count} recursos',
  one_asset: 'um recurso',
  no_assets: 'nenhum recurso',
  no_files_found: 'Nenhum arquivo encontrado.',
  no_entries_found: 'Nenhuma entrada encontrada.',
  upload_assets: 'Enviar Novos Recursos',
  edit_options: 'Opções de Edição',
  show_edit_options: 'Mostrar Opções de Edição',
  edit_asset: 'Editar Recurso',
  edit_x: 'Editar {name}',
  wrap_long_lines: 'Quebrar Linhas Longas',
  rename_asset: 'Renomear Recurso',
  rename_x: 'Renomear {name}',
  enter_new_name_for_asset: 'Digite um novo nome abaixo.',
  enter_new_name_for_asset_with_one_entry:
    'Digite um novo nome abaixo. Uma entrada usando o recurso também será atualizada.',
  enter_new_name_for_asset_with_many_entries:
    'Digite um novo nome abaixo. {count} entradas usando o recurso serão atualizadas.',
  enter_new_name_for_asset_error: {
    empty: 'O nome do arquivo não pode estar vazio.',
    character: 'O nome do arquivo não pode conter caracteres especiais.',
    duplicate: 'Este nome de arquivo já está sendo usado para outro recurso.',
  },
  replace_asset: 'Substituir Recurso',
  replace_x: 'Substituir {name}',
  click_to_browse: 'Clique para navegar…',
  tap_to_browse: 'Toque para navegar…',
  drop_file_or_click_to_browse: 'Solte um arquivo aqui ou clique para navegar…',
  drop_files_or_click_to_browse: 'Solte arquivos aqui ou clique para navegar…',
  drop_image_file_or_click_to_browse: 'Solte um arquivo de imagem aqui ou clique para navegar…',
  drop_image_files_or_click_to_browse: 'Solte arquivos de imagem aqui ou clique para navegar…',
  drop_file_here: 'Solte um arquivo aqui',
  drop_files_here: 'Solte arquivos aqui',
  unsupported_file_type: 'Tipo de Arquivo Não Suportado',
  dropped_file_type_mismatch: 'O arquivo solto não é do tipo {type}. Por favor, tente novamente.',
  dropped_image_type_mismatch:
    'O arquivo solto não é suportado. Apenas imagens AVIF, GIF, JPEG, PNG, WebP ou SVG são aceitas. Por favor, tente novamente.',
  choose_file: 'Escolher Arquivo',
  choose_files: 'Escolher Arquivos',
  delete_asset: 'Excluir Recurso',
  delete_assets: 'Excluir Recursos',
  delete_selected_asset: 'Excluir Recurso Selecionado',
  delete_selected_assets: 'Excluir Recursos Selecionados',
  confirm_deleting_this_asset: 'Tem certeza de que deseja excluir este recurso?',
  confirm_deleting_selected_asset: 'Tem certeza de que deseja excluir o recurso selecionado?',
  confirm_deleting_selected_assets:
    'Tem certeza de que deseja excluir os {count} recursos selecionados?',
  confirm_deleting_all_assets: 'Tem certeza de que deseja excluir todos os recursos?',
  delete_entry: 'Excluir Entrada',
  delete_entries: 'Excluir Entradas',
  delete_selected_entry: 'Excluir Entrada Selecionada',
  delete_selected_entries: 'Excluir Entradas Selecionadas',
  confirm_deleting_this_entry: 'Tem certeza de que deseja excluir esta entrada?',
  confirm_deleting_this_entry_with_assets:
    'Tem certeza de que deseja excluir esta entrada e os recursos associados?',
  confirm_deleting_selected_entry: 'Tem certeza de que deseja excluir a entrada selecionada?',
  confirm_deleting_selected_entry_with_assets:
    'Tem certeza de que deseja excluir a entrada selecionada e os recursos associados?',
  confirm_deleting_selected_entries:
    'Tem certeza de que deseja excluir as {count} entradas selecionadas?',
  confirm_deleting_selected_entries_with_assets:
    'Tem certeza de que deseja excluir as {count} entradas selecionadas e os recursos associados?',
  confirm_deleting_all_entries: 'Tem certeza de que deseja excluir todas as entradas?',
  confirm_deleting_all_entries_with_assets:
    'Tem certeza de que deseja excluir todas as entradas e os recursos associados?',
  processing_file: 'Processando um arquivo. Isso pode levar algum tempo.',
  processing_files: 'Processando arquivos. Isso pode levar algum tempo.',
  uploading_files: 'Enviando Arquivos',
  confirm_replacing_file: 'Tem certeza de que deseja substituir "{name}" pelo seguinte arquivo?',
  confirm_uploading_file:
    'Tem certeza de que deseja salvar o seguinte arquivo na pasta "{folder}"?',
  confirm_uploading_files:
    'Tem certeza de que deseja salvar os seguintes {count} arquivos na pasta "{folder}"?',
  oversized_files: 'Arquivos Muito Grandes',
  warning_oversized_file:
    'Este arquivo não pode ser enviado porque excede o tamanho máximo de {size}. Por favor, reduza o tamanho ou selecione um arquivo diferente.',
  warning_oversized_files:
    'Estes arquivos não podem ser enviados porque excedem o tamanho máximo de {size}. Por favor, reduza os tamanhos ou selecione arquivos diferentes.',
  uploading_files_progress: 'Enviando arquivos…',
  uploading_file_progress: 'Enviando arquivo…',
  uploading_files_failed: 'Não foi possível enviar os arquivos',
  uploading_file_failed: 'Não foi possível enviar o arquivo',
  file_meta: '{type} · {size}',
  file_meta_converted_from_x: '(convertido de {type})',
  no_entries_created: 'Esta coleção ainda não possui entradas.',
  create_new_entry: 'Criar Nova Entrada',
  entry: 'Entrada',
  index_file: 'Arquivo de Índice',
  no_files_in_collection: 'Nenhum arquivo disponível nesta coleção.',
  asset_info: 'Informações do Recurso',
  select_asset_show_info: 'Selecione um recurso para mostrar as informações.',
  duplicate_entry: 'Duplicar Entrada',
  entry_duplicated: 'A entrada foi duplicada. Agora é um novo rascunho.',
  entry_validation_error: 'Um campo tem um erro. Por favor, corrija-o para salvar a entrada.',
  entry_validation_errors: '{count} campos têm erros. Por favor, corrija-os para salvar a entrada.',
  entry_saved: 'A entrada foi salva.',
  entry_saved_and_published: 'A entrada foi salva e publicada.',
  entry_deleted: 'A entrada foi excluída.',
  entries_deleted: '{count} entradas foram excluídas.',
  asset_saved: 'O recurso foi salvo.',
  asset_saved_and_published: 'O recurso foi salvo e publicado.',
  assets_saved: '{count} recursos foram salvos.',
  assets_saved_and_published: '{count} recursos foram salvos e publicados.',
  asset_url_copied: 'A URL do recurso foi copiada para a área de transferência.',
  asset_urls_copied: 'As URLs dos recursos foram copiadas para a área de transferência.',
  asset_path_copied: 'O caminho do arquivo do recurso foi copiado para a área de transferência.',
  asset_paths_copied:
    'Os caminhos dos arquivos dos recursos foram copiados para a área de transferência.',
  asset_data_copied: 'O arquivo do recurso foi copiado para a área de transferência.',
  asset_downloaded: 'O arquivo do recurso foi baixado.',
  assets_downloaded: 'Os arquivos dos recursos foram baixados.',
  asset_moved: 'O recurso foi movido.',
  assets_moved: '{count} recursos foram movidos.',
  asset_renamed: 'O recurso foi renomeado.',
  assets_renamed: '{count} recursos foram renomeados.',
  asset_deleted: 'O recurso foi excluído.',
  assets_deleted: '{count} recursos foram excluídos.',

  // Content editor
  content_editor: 'Editor de Conteúdo',
  restore_backup_title: 'Restaurar Rascunho',
  restore_backup_description:
    'Esta entrada tem um backup de {datetime}. Você deseja restaurar o rascunho editado?',
  draft_backup_saved: 'O backup do rascunho foi salvo.',
  draft_backup_restored: 'O backup do rascunho foi restaurado.',
  draft_backup_deleted: 'O backup do rascunho foi excluído.',
  cancel_editing: 'Cancelar Edição',
  create_entry_title: 'Criando {name}',
  create_entry_announcement: 'Você está criando uma nova entrada na coleção "{collection}".',
  edit_entry_title: '{collection} › {entry}',
  edit_entry_announcement: 'Você está editando a entrada "{entry}" na coleção "{collection}".',
  edit_file_announcement: 'Você está editando o arquivo "{file}" na coleção "{collection}".',
  edit_singleton_announcement: 'Você está editando o arquivo "{file}".',
  save_and_publish: 'Salvar e Publicar',
  save_without_publishing: 'Salvar sem Publicar',
  show_editor_options: 'Mostrar Opções do Editor',
  editor_options: 'Opções do Editor',
  show_preview: 'Mostrar Visualização',
  sync_scrolling: 'Sincronizar Rolagem',
  switch_locale: 'Trocar Localidade',
  locale_content_disabled_short: '(desabilitado)',
  locale_content_error_short: '(erro)',
  edit: 'Editar',
  preview: 'Visualizar',
  edit_x_locale: 'Editar Conteúdo em {locale}',
  preview_x_locale: 'Visualizar Conteúdo em {locale}',
  content_preview: 'Visualização do Conteúdo',
  show_content_options_x_locale: 'Mostrar Opções de Conteúdo em {locale}',
  content_options_x_locale: 'Opções de Conteúdo em {locale}',
  x_field: 'Campo "{field}"',
  show_field_options: 'Mostrar Opções do Campo',
  field_options: 'Opções do Campo',
  unsupported_field_type_x: 'Tipo de campo não suportado: {name}',
  enable_x_locale: 'Habilitar {locale}',
  reenable_x_locale: 'Reabilitar {locale}',
  disable_x_locale: 'Desabilitar {locale}',
  locale_x_has_been_disabled: 'O conteúdo em {locale} foi desabilitado.',
  locale_x_now_disabled:
    'O conteúdo em {locale} está desabilitado agora. Ele será excluído quando você salvar a entrada.',
  view_in_repository: 'Ver no Repositório',
  view_on_x: 'Ver no {service}',
  view_on_live_site: 'Ver no Site ao Vivo',
  copy_from: 'Copiar de…',
  copy_from_x: 'Copiar de {locale}',
  translation_options: 'Opções de Tradução',
  translate: 'Traduzir',
  translate_field: 'Traduzir Campo',
  translate_fields: 'Traduzir Campos',
  translate_from: 'Traduzir de…',
  translate_from_x: 'Traduzir de {locale}',
  revert_changes: 'Reverter Alterações',
  revert_all_changes: 'Reverter Todas as Alterações',
  edit_slug: 'Editar Slug',
  edit_slug_warning:
    'Alterar o slug pode quebrar links internos e externos para a entrada. Atualmente, o Sveltia CMS não atualiza referências criadas com campos de Relação, então você precisará atualizar manualmente essas referências junto com outros links.',
  edit_slug_error: {
    empty: 'O slug não pode estar vazio.',
    duplicate: 'Este slug já está sendo usado para outra entrada.',
  },
  required: 'Obrigatório',
  editor: {
    translation: {
      none: 'Nada foi traduzido.',
      started: 'Traduzindo…',
      error: 'Ocorreu um erro ao traduzir.',
      complete: {
        one: 'Traduziu o campo de {source}.',
        many: 'Traduziu {count} campos de {source}.',
      },
    },
    copy: {
      none: 'Nada foi copiado.',
      complete: {
        one: 'Copiou o campo de {source}.',
        many: 'Copiou {count} campos de {source}.',
      },
    },
  },
  validation: {
    value_missing: 'Este campo é obrigatório.',
    range_underflow: {
      number: 'O valor deve ser maior ou igual a {min}.',
      select_many: 'Você deve selecionar pelo menos {min} itens.',
      select_one: 'Você deve selecionar pelo menos {min} item.',
      add_many: 'Você deve adicionar pelo menos {min} itens.',
      add_one: 'Você deve adicionar pelo menos {min} item.',
    },
    range_overflow: {
      number: 'O valor deve ser menor ou igual a {max}.',
      select_many: 'Você não pode selecionar mais de {max} itens.',
      select_one: 'Você não pode selecionar mais de {max} item.',
      add_many: 'Você não pode adicionar mais de {max} itens.',
      add_one: 'Você não pode adicionar mais de {max} item.',
    },
    too_short: {
      one: 'Você deve digitar pelo menos {min} caractere.',
      many: 'Você deve digitar pelo menos {min} caracteres.',
    },
    too_long: {
      one: 'Você não pode digitar mais de {max} caractere.',
      many: 'Você não pode digitar mais de {max} caracteres.',
    },
    type_mismatch: {
      number: 'Por favor, digite um número.',
      email: 'Por favor, digite um email válido.',
      url: 'Por favor, digite uma URL válida.',
    },
  },
  saving_entry: {
    error: {
      title: 'Erro',
      description: 'Ocorreu um erro ao salvar a entrada. Por favor, tente novamente mais tarde.',
    },
  },

  // Media details
  viewing_x_asset_details: 'Você está visualizando os detalhes do recurso "{name}".',
  asset_editor: 'Editor de Recursos',
  preview_unavailable: 'Visualização Indisponível.',
  public_url: 'URL Pública',
  public_urls: 'URLs Públicas',
  file_path: 'Caminho do Arquivo',
  file_paths: 'Caminhos dos Arquivos',
  file_data: 'Dados do Arquivo',
  kind: 'Tipo',
  size: 'Tamanho',
  dimensions: 'Dimensões',
  duration: 'Duração',
  used_in: 'Usado em',
  created_date: 'Data de Criação',
  location: 'Localização',
  map_lat_lng: 'Mapa mostrando latitude {latitude}, longitude {longitude}',

  // Fields
  select_file: 'Selecionar Arquivo',
  select_image: 'Selecionar Imagem',
  replace_file: 'Substituir Arquivo',
  replace_image: 'Substituir Imagem',
  remove_file: 'Remover Arquivo',
  remove_image: 'Remover Imagem',
  remove_this_item: 'Remover Este Item',
  move_up: 'Mover para Cima',
  move_down: 'Mover para Baixo',
  add_x: 'Adicionar {name}',
  add_item_above: 'Adicionar Item Acima',
  add_item_below: 'Adicionar Item Abaixo',
  select_list_type: 'Selecionar Tipo de Lista',
  opacity: 'Opacidade',
  unselected_option: '(Nenhum)',
  assets_dialog: {
    title: {
      file: 'Selecionar Arquivo',
      image: 'Selecionar Imagem',
    },
    search_for_file: 'Pesquisar Arquivos',
    search_for_image: 'Pesquisar Imagens',
    locations: 'Localizações',
    folder: {
      field: 'Recursos do Campo',
      entry: 'Recursos da Entrada',
      file: 'Recursos do Arquivo',
      collection: 'Recursos da Coleção',
      global: 'Recursos Globais',
    },
    error: {
      invalid_key:
        'Sua Chave da API é inválida ou expirou. Por favor, verifique e tente novamente.',
      search_fetch_failed:
        'Ocorreu um erro ao pesquisar recursos. Por favor, tente novamente mais tarde.',
      image_fetch_failed:
        'Ocorreu um erro ao baixar o recurso selecionado. Por favor, tente novamente mais tarde.',
    },
    available_images: 'Imagens Disponíveis',
    enter_url: 'Digite a URL',
    enter_file_url: 'Digite a URL do arquivo:',
    enter_image_url: 'Digite a URL da imagem:',
    large_file: {
      title: 'Arquivo Grande',
    },
    photo_credit: {
      title: 'Crédito da Foto',
      description: 'Use o seguinte crédito, se possível:',
    },
    unsaved: 'Não Salvo',
  },
  character_counter: {
    min_max: {
      one: '{count} caractere digitado. Mínimo: {min}. Máximo: {max}.',
      many: '{count} caracteres digitados. Mínimo: {min}. Máximo: {max}.',
    },
    min: {
      one: '{count} caractere digitado. Mínimo: {min}.',
      many: '{count} caracteres digitados. Mínimo: {min}.',
    },
    max: {
      one: '{count} caractere digitado. Máximo: {max}.',
      many: '{count} caracteres digitados. Máximo: {max}.',
    },
  },
  youtube_video_player: 'Reprodutor de vídeo do YouTube',
  today: 'Hoje',
  now: 'Agora',
  editor_components: {
    image: 'Imagem',
    src: 'Fonte',
    alt: 'Texto Alt',
    title: 'Título',
    link: 'Link',
  },
  key_value: {
    key: 'Chave',
    value: 'Valor',
    action: 'Ação',
    empty_key: 'Chave é obrigatória.',
    duplicate_key: 'Chave deve ser única.',
  },
  find_place: 'Encontrar um Local',
  use_your_location: 'Usar Sua Localização',
  geolocation_error_title: 'Erro de Geolocalização',
  geolocation_error_body: 'Ocorreu um erro ao recuperar sua localização.',
  geolocation_unsupported: 'A API de Geolocalização não é suportada por este navegador.',

  // Content preview
  boolean: {
    true: 'Sim',
    false: 'Não',
  },

  // Integrations
  cloud_storage: {
    invalid: 'O serviço não está configurado corretamente.',
    auth: {
      api_key: {
        initial: 'Digite sua chave de API para entrar no {service}.',
        requested: 'Validando…',
        error: 'A chave de API fornecida é inválida. Por favor, verifique e tente novamente.',
      },
      password: {
        initial: 'Digite sua senha para entrar no {service}.',
        requested: 'Entrando…',
        error: 'Nome de usuário ou senha incorretos. Por favor, verifique e tente novamente.',
      },
    },
    cloudinary: {
      iframe_title: 'Biblioteca de mídia do Cloudinary',
      activate: {
        button_label: 'Ativar Cloudinary',
        description: 'Após entrar, clique no botão Entrar novamente para continuar.',
      },
      auth: {
        initial: 'Digite seu Segredo da API para usar o Cloudinary.',
        requested: 'Validando…',
        error: 'O Segredo da API fornecido é inválido. Por favor, verifique e tente novamente.',
      },
    },
    uploadcare: {
      auth: {
        initial: 'Digite sua Chave Secreta da API para usar o Uploadcare.',
        requested: 'Validando…',
        error: 'A Chave Secreta fornecida é inválida. Por favor, verifique e tente novamente.',
      },
    },
  },

  // Configuration
  config: {
    one_error:
      'Há um erro na configuração do CMS. Por favor, resolva o problema e tente novamente.',
    many_errors:
      'Há erros na configuração do CMS. Por favor, resolva os problemas e tente novamente.',
    error_locator: {
      collection: 'coleção {collection}',
      file: 'arquivo {file}',
      field: 'campo `{field}`',
    },
    error: {
      no_secure_context: 'O Sveltia CMS funciona apenas com URLs HTTPS ou localhost.',
      fetch_failed: 'O arquivo de configuração não pôde ser recuperado.',
      fetch_failed_not_ok: 'Resposta HTTP retornou com status {status}.',
      parse_failed: 'O arquivo de configuração não pôde ser analisado.',
      parse_failed_invalid_object: 'O arquivo de configuração não é um objeto JavaScript válido.',
      parse_failed_unsupported_type:
        'O arquivo de configuração não é um tipo de arquivo válido. Apenas YAML, TOML e JSON são suportados.',
      no_collection: 'As coleções não estão definidas.',
      missing_backend: 'O backend não está definido.',
      missing_backend_name: 'O nome do backend não está definido.',
      unsupported_backend: 'O backend "{name}" configurado não é suportado.',
      missing_repository: 'O repositório não está definido.',
      invalid_repository:
        'O repositório configurado é inválido. Deve estar no formato "proprietário/repo".',
      oauth_implicit_flow:
        'O método de autenticação configurado (fluxo implícito) não é suportado.',
      oauth_no_app_id: 'O ID do aplicativo OAuth não está definido.',
      missing_media_folder: 'A pasta de mídia não está definida.',
      invalid_media_folder: 'A pasta de mídia configurada é inválida. Deve ser uma string.',
      invalid_public_folder: 'A pasta pública configurada é inválida. Deve ser uma string.',
      public_folder_relative_path:
        'A pasta pública configurada é inválida. Deve ser um caminho absoluto começando com "/".',
      public_folder_absolute_url: 'Uma URL absoluta para a opção de pasta pública não é suportada.',
      invalid_collection_no_options:
        'A coleção deve ter a opção `folder`, `files` ou `divider` definida.',
      invalid_collection_multiple_options:
        'A coleção não pode ter as opções `folder`, `files` e `divider` juntas.',
      file_format_mismatch: 'A extensão `{extension}` não corresponde ao formato `{format}`.',
      invalid_slug_slash:
        'O template de slug `{slug}` é inválido, pois não pode conter barras. Para organizar entradas em subpastas, use a opção `path` em vez de `slug`.',
      missing_collection_name:
        'A coleção {count} deve ter a opção `name` definida como uma string não vazia.',
      invalid_collection_name:
        'O nome da coleção `{name}` é inválido. Não deve conter caracteres especiais.',
      duplicate_collection_name:
        'Os nomes das coleções devem ser únicos, mas `{name}` é usado mais de uma vez.',
      missing_collection_file_name:
        'O arquivo da coleção {count} deve ter a opção `name` definida como uma string não vazia.',
      invalid_collection_file_name:
        'O nome do arquivo da coleção `{name}` é inválido. Não deve conter caracteres especiais.',
      duplicate_collection_file_name:
        'Os nomes dos arquivos da coleção devem ser únicos, mas `{name}` é usado mais de uma vez.',
      missing_field_name:
        'O campo {count} deve ter a opção `name` definida como uma string não vazia.',
      invalid_field_name:
        'O nome do campo `{name}` é inválido. Não deve conter caracteres especiais.',
      duplicate_field_name:
        'Os nomes dos campos devem ser únicos, mas `{name}` é usado mais de uma vez.',
      missing_variable_type:
        'O tipo de variável {count} deve ter a opção `name` definida como uma string não vazia.',
      invalid_variable_type:
        'O nome do tipo de variável `{name}` é inválido. Não deve conter caracteres especiais.',
      duplicate_variable_type:
        'Os nomes dos tipos de variável devem ser únicos, mas `{name}` é usado mais de uma vez.',
      date_field_type:
        'O tipo de campo Date obsoleto não é suportado no Sveltia CMS. Use o tipo de campo DateTime com a opção `time_format:false` em vez disso.',
      unsupported_deprecated_option:
        'A opção obsoleta `{prop}` não é suportada no Sveltia CMS. Use a opção `{newProp}` em vez disso.',
      allow_multiple:
        'A opção `allow_multiple` não é suportada no Sveltia CMS. Use a opção `multiple` em vez disso, que tem padrão `false`.',
      invalid_list_field: 'O campo List não pode ter as opções `field`, `fields` e `types` juntas.',
      invalid_object_field: 'O campo Object não pode ter as opções `fields` e `types` juntas.',
      object_field_missing_fields: 'O campo Object deve ter a opção `fields` ou `types` definida.',
      relation_field_invalid_collection:
        'A coleção referenciada `{collection}` é inválida ou não está definida.',
      relation_field_invalid_collection_file:
        'O arquivo referenciado `{file}` é inválido ou não está definido.',
      relation_field_missing_file_name:
        'A opção `file` deve ser definida para uma relação com uma coleção de arquivos.',
      relation_field_invalid_value_field:
        'O campo de valor referenciado `{field}` é inválido ou não está definido.',
      unexpected: 'Erro inesperado',
    },
    warning: {
      open_authoring_unsupported: 'A autoria aberta ainda não é suportada no Sveltia CMS.',
      editorial_workflow_github_only:
        'O fluxo editorial atualmente é totalmente suportado apenas com o backend do GitHub.',
      nested_collections_unsupported: 'Coleções aninhadas ainda não são suportadas no Sveltia CMS.',
      unsupported_ignored_option:
        'A opção `{prop}` não é suportada no Sveltia CMS. Ela será ignorada.',
    },
  },

  // Backends
  local_backend: {
    indicator: 'Local',
    unsupported_browser:
      'O desenvolvimento local não é suportado no seu navegador. Por favor, use Chrome ou Edge.',
    disabled:
      'O desenvolvimento local está desabilitado no seu navegador. <a>Veja como habilitá-lo</a>.',
  },

  // Editorial Workflow
  status: {
    draft: 'Rascunho',
    drafts: 'Rascunhos',
    in_review: 'Em Revisão',
    pending_review: 'Em Revisão',
    pending_publish: 'Pronto',
    ready: 'Pronto',
  },
  editing_workflow_entry: 'Editando PR de Rascunho',
  workflow_branch: 'Branch do Fluxo de Trabalho',
  status_change_failed: 'Falha ao alterar o status',
  drag_to_change_status: 'Arraste para alterar o status',
  drop_entry_here: 'Solte a entrada aqui',
  request_review: 'Solicitar Revisão',
  approve: 'Aprovar',
  request_changes: 'Solicitar Alterações',
  back_to_review: 'Voltar para Revisão',
  confirm_publish: 'Publicar "{title}"?',
  confirm_delete_draft: 'Excluir rascunho "{title}"?',
  build_preview: 'Construir Visualização',
  rebuild_preview: 'Reconstruir',
  building_preview: 'Construindo...',
  view_preview: 'Ver Visualização',
  preview_error: 'Falha na Visualização',
  // Batch Mode
  batch_mode: 'Modo em Lote',
  batch: 'Lote',
  batch_changes: 'Mudanças em Lote',
  inactive: 'Inativo',
  confirm_publish_batch: 'Publicar lote com {count} mudanças?',
  confirm_publish_batch_message:
    'Este lote contém {count} mudanças. Todas as mudanças serão publicadas para a branch main e o PR será mergeado.',
  confirm_delete_batch: 'Excluir este lote com {count} mudanças?',
  confirm_delete_batch_message:
    'Este lote contém {count} mudanças. O PR será fechado sem merge e a branch será excluída.',
  publish_batch: 'Publicar Lote',
  batch_ready_alert: 'As últimas mudanças em lote já estão prontas. Abrir um novo lote?',
  batch_building_alert: 'A visualização está sendo construída. Abrir um novo lote?',

  // Settings
  categories: 'Categorias',
  prefs: {
    changes: {
      api_key_saved: 'A chave da API foi salva.',
      api_key_removed: 'A chave da API foi removida.',
    },
    error: {
      permission_denied:
        'O acesso ao armazenamento do navegador (Cookie) foi negado. Por favor, verifique a permissão e tente novamente.',
    },
    appearance: {
      title: 'Aparência',
      theme: 'Tema',
      select_theme: 'Selecionar Tema',
    },
    theme: {
      auto: 'Automático',
      dark: 'Escuro',
      light: 'Claro',
    },
    language: {
      title: 'Idioma',
      ui_language: {
        title: 'Idioma da Interface do Usuário',
        select_language: 'Selecionar Idioma',
      },
    },
    contents: {
      title: 'Conteúdos',
      editor: {
        title: 'Editor',
        use_draft_backup: {
          switch_label: 'Fazer backup automático de rascunhos de entrada',
        },
        close_on_save: {
          switch_label: 'Fechar o editor após salvar um rascunho',
        },
        close_with_escape: {
          switch_label: 'Fechar o editor com a tecla Escape',
        },
      },
    },
    i18n: {
      title: 'Internacionalização',
      default_translator: {
        title: 'Serviço de Tradução Padrão',
        select_service: 'Selecionar Serviço',
      },
      translator: {
        field_label: 'Chave do {service}',
        description:
          'Inscreva-se no <a {homeHref}>{service}</a> e digite <a {apiKeyHref}>sua Chave da API</a> aqui para habilitar a tradução rápida de campos de entrada de texto.',
      },
    },
    media: {
      title: 'Mídia',
      stock_photos: {
        title: 'Imagens Gratuitas do {service}',
        field_label: 'Chave da API do {service}',
        description:
          'Inscreva-se na <a {homeHref}>API do {service}</a> e digite <a {apiKeyHref}>sua Chave da API</a> aqui para inserir fotos de banco gratuitas em campos de entrada de imagem.',
        credit: 'Fotos fornecidas por {service}',
      },
      cloud_storage: {
        field_label: 'Chave da API do {service}',
        description:
          'Digite sua chave da API do {service} para habilitar o envio de recursos para o {service}.',
      },
      libraries_disabled: 'Bibliotecas de mídia externas estão desabilitadas pelo administrador.',
    },
    accessibility: {
      title: 'Acessibilidade',
      underline_links: {
        title: 'Sublinhar Links',
        description:
          'Mostrar sublinhado para links na visualização de entrada e rótulos da interface do usuário.',
        switch_label: 'Sempre Sublinhar Links',
      },
    },
    advanced: {
      title: 'Avançado',
      beta: {
        title: 'Recursos Beta',
        description: 'Habilitar alguns recursos beta que podem ser instáveis ou não traduzidos.',
        switch_label: 'Participar do Programa Beta',
      },
      developer_mode: {
        title: 'Modo de Desenvolvedor',
        description:
          'Habilitar alguns recursos orientados a desenvolvedores, incluindo logs de console detalhados e menus de contexto nativos.',
        switch_label: 'Habilitar Modo de Desenvolvedor',
      },
      deploy_hook: {
        title: 'Hook de Implantação',
        description:
          'Digite uma URL de webhook a ser chamada quando você acionar manualmente uma implantação selecionando Publicar Alterações. Isso pode ser deixado em branco se você estiver usando GitHub Actions.',
        url: {
          field_label: 'URL do Hook',
          saved: 'A URL do hook foi salva.',
          removed: 'A URL do hook foi removida.',
        },
        auth: {
          field_label: 'Cabeçalho de autorização (por exemplo, Bearer <token>) (opcional)',
          saved: 'O cabeçalho de autorização foi salvo.',
          removed: 'O cabeçalho de autorização foi removido.',
        },
      },
    },
  },

  // Keyboard shortcuts
  keyboard_shortcuts_: {
    view_content_library: 'Ver Biblioteca de Conteúdo',
    view_asset_library: 'Ver Biblioteca de Recursos',
    search: 'Pesquisar entradas e recursos',
    create_entry: 'Criar uma nova entrada',
    save_entry: 'Salvar uma entrada',
    cancel_editing: 'Cancelar edição de entrada',
  },

  // File types
  file_type_labels: {
    avif: 'imagem AVIF',
    bmp: 'imagem Bitmap',
    gif: 'imagem GIF',
    ico: 'Ícone',
    jpeg: 'imagem JPEG',
    jpg: 'imagem JPEG',
    png: 'imagem PNG',
    svg: 'imagem SVG',
    tif: 'imagem TIFF',
    tiff: 'imagem TIFF',
    webp: 'imagem WebP',
    avi: 'vídeo AVI',
    m4v: 'vídeo MP4',
    mov: 'vídeo QuickTime',
    mp4: 'vídeo MP4',
    mpeg: 'vídeo MPEG',
    mpg: 'vídeo MPEG',
    ogg: 'vídeo Ogg',
    ogv: 'vídeo Ogg',
    ts: 'vídeo MPEG',
    webm: 'vídeo WebM',
    '3gp': 'vídeo 3GPP',
    '3g2': 'vídeo 3GPP2',
    aac: 'áudio AAC',
    mid: 'MIDI',
    midi: 'MIDI',
    m4a: 'áudio MP4',
    mp3: 'áudio MP3',
    oga: 'áudio Ogg',
    opus: 'áudio OPUS',
    wav: 'áudio WAV',
    weba: 'áudio WebM',
    csv: 'planilha CSV',
    doc: 'documento Word',
    docx: 'documento Word',
    odp: 'apresentação OpenDocument',
    ods: 'planilha OpenDocument',
    odt: 'texto OpenDocument',
    pdf: 'documento PDF',
    ppt: 'apresentação PowerPoint',
    pptx: 'apresentação PowerPoint',
    rtf: 'documento Rich text',
    xls: 'planilha Excel',
    xlsx: 'planilha Excel',
    html: 'texto HTML',
    js: 'JavaScript',
    json: 'texto JSON',
    md: 'texto Markdown',
    toml: 'texto TOML',
    yaml: 'texto YAML',
    yml: 'texto YAML',
  },

  // file size units
  file_size_units: {
    b: '{size} bytes',
    kb: '{size} KB',
    mb: '{size} MB',
    gb: '{size} GB',
    tb: '{size} TB',
  },
};
