/* Logo 3D do rodapé (Three.js r149, carregado só quando o rodapé se aproxima).
   As letras da logo oficial viram blocos de ouro maciço: frente com o degradê do arquivo original
   (claro em cima, queimado embaixo), laterais e chanfro em ouro escovado mais escuro, reflexo de estúdio
   e sombra no chão. O BJJ é um bloco à parte, branco perolado no escuro e grafite no claro.
   A rolagem levanta a logo do chão; o mouse inclina; de tempos em tempos um brilho atravessa as letras.
   Sem WebGL, fica a logo plana de sempre. Contornos: laços fechados em pontos do PDF (y para baixo). */
(function () {
  var D = {"w":838.4,"h":235.3,"ouro":[[548.5,-0.1,559.0,-0.1,561.0,0.5,562.5,1.2,564.6,3.5,565.1,5.0,565.3,7.0,565.2,22.0,564.6,24.0,563.6,25.5,561.0,27.2,559.5,27.6,557.5,27.8,547.5,28.1,545.5,27.7,543.5,26.6,542.3,25.5,541.3,24.0,540.7,21.0,540.7,7.5,541.3,4.5,542.3,2.5,543.5,1.4,546.0,0.4],[279.0,0.5,286.5,0.2,289.5,0.3,292.0,1.4,293.1,2.5,293.6,3.5,293.8,5.0,293.5,6.0,292.5,7.2,291.5,7.5,290.0,7.6,286.0,5.8,283.5,5.3,281.0,6.0,280.3,6.5,279.8,7.5,279.9,9.0,281.0,10.2,283.0,10.8,288.0,11.0,290.0,11.4,292.0,12.5,293.5,14.0,294.1,15.0,294.7,17.0,295.0,20.0,294.7,22.5,293.5,24.8,291.5,26.6,290.0,27.2,287.5,27.7,281.5,28.2,278.5,28.2,275.0,27.1,274.0,26.4,273.0,25.0,272.7,23.5,272.8,22.5,273.5,21.3,274.5,20.7,276.0,20.3,280.0,21.7,284.0,22.0,285.5,21.6,286.6,20.5,286.8,20.0,286.6,18.5,285.4,17.5,284.0,16.9,281.0,16.3,278.0,16.2,275.5,15.6,273.8,14.5,272.3,12.0,271.8,10.0,271.8,7.0,272.4,4.0,272.9,3.0,274.0,1.9,275.6,1.0],[332.0,0.5,345.5,0.5,347.3,1.0,348.0,1.6,348.5,2.5,348.3,4.0,347.5,4.9,343.6,6.5,342.4,7.5,341.9,8.5,341.3,14.0,341.2,24.5,340.6,26.0,340.0,26.7,339.0,27.2,337.5,27.1,336.6,26.5,335.8,25.5,335.4,24.0,335.3,11.5,335.2,9.5,334.7,8.0,333.0,6.3,329.5,5.1,328.8,4.5,328.4,3.5,328.4,2.5,329.1,1.5,330.0,0.9],[446.5,0.5,460.0,0.3,462.5,1.2,464.7,3.5,465.1,4.5,465.8,7.5,465.7,21.5,464.7,24.5,462.5,26.7,460.5,27.5,457.5,28.2,450.0,28.2,444.5,27.5,443.5,27.1,442.5,26.0,441.8,23.5,441.8,3.5,442.5,2.0,443.6,1.0,445.0,0.6],[403.0,1.0,404.0,0.8,405.5,1.3,406.5,2.5,407.1,4.5,407.2,12.5,406.7,20.0,406.1,23.5,405.1,25.5,403.5,26.8,402.5,27.1,398.0,27.7,389.5,28.0,387.5,27.6,386.2,27.0,384.9,26.0,384.2,25.0,383.3,22.0,383.3,5.0,384.0,2.5,385.0,1.4,386.5,1.0,387.5,1.2,388.6,2.0,389.1,3.0,389.3,4.0,389.3,15.5,389.9,19.0,391.0,20.7,392.5,21.6,394.0,22.0,396.0,22.0,398.0,21.6,399.0,21.1,400.1,20.0,400.7,19.0,401.1,17.5,401.3,15.0,401.0,8.0,401.2,4.0,401.8,2.0],[502.0,0.9,503.5,0.7,505.0,1.3,505.8,2.5,506.2,4.5,506.2,24.5,505.2,26.5,504.5,27.1,503.5,27.5,501.5,27.1,500.8,26.5,500.2,25.5,499.8,23.5,500.3,19.0,500.2,4.0,500.8,2.0],[451.6,6.0,449.5,6.9,448.3,8.5,447.8,12.0,447.8,17.5,448.4,19.5,450.0,21.3,452.5,22.2,454.5,22.1,456.0,21.7,457.3,21.0,458.7,19.5,459.1,18.5,459.7,16.0,459.7,14.5,459.1,11.0,458.2,8.5,457.0,7.0,456.0,6.4,454.0,5.8],[551.0,6.0,550.0,6.3,549.1,7.0,547.8,9.0,547.2,13.0,547.4,18.0,548.2,20.0,550.0,21.5,552.0,22.0,554.5,22.0,556.0,21.7,557.6,20.5,558.2,19.5,558.5,18.0,558.7,11.5,558.2,8.5,557.5,7.3,556.0,6.2,554.5,5.8],[220.0,11.5,236.5,11.5,237.0,12.0,237.0,16.5,236.5,16.8,172.0,16.7,126.0,16.2,63.5,15.0,62.8,14.5,63.5,14.2,68.5,13.8,128.0,12.3],[601.5,11.3,625.0,11.3,637.0,11.7,711.5,12.3,755.5,13.3,773.5,14.0,775.0,14.2,775.5,14.5,775.0,14.8,766.5,15.2,749.0,15.7,678.5,16.3,640.5,17.0,613.5,17.0,602.0,16.7,601.5,16.5,601.3,16.0],[265.0,51.5,271.0,51.8,276.5,52.8,280.0,54.2,285.0,57.4,288.0,60.1,290.6,63.5,292.6,67.5,294.2,72.0,294.8,76.0,294.8,134.5,294.2,140.0,293.5,142.5,292.2,146.0,289.2,151.5,286.0,155.1,280.5,159.1,277.5,160.6,274.5,161.7,263.5,163.7,251.0,163.8,238.5,165.2,229.0,165.5,224.0,165.5,220.5,165.1,215.0,163.6,212.5,162.6,209.5,160.4,206.3,157.0,205.3,155.5,202.9,149.5,202.0,144.5,202.0,88.0,202.7,82.5,202.8,77.5,203.8,73.0,205.3,68.5,206.3,66.5,208.8,63.0,210.8,60.5,213.5,57.8,217.0,55.4,222.5,53.3,226.5,52.3,229.5,52.0,247.0,52.2,251.5,51.8,258.5,51.9],[315.5,51.5,333.0,51.3,335.0,51.8,336.0,52.4,337.2,54.0,337.5,56.0,337.7,66.0,337.7,127.0,337.9,130.0,338.9,132.5,340.0,133.9,342.0,135.7,343.0,136.2,345.5,136.7,351.5,136.7,357.0,136.2,374.0,136.2,380.5,135.5,383.5,135.8,384.5,136.6,385.2,137.5,385.7,139.5,385.6,154.0,385.2,156.0,384.0,157.6,383.0,158.2,381.0,158.7,368.5,158.7,361.0,159.3,332.0,159.5,329.0,159.2,326.0,158.6,322.0,156.6,318.0,153.4,315.9,151.0,314.3,148.0,313.3,145.5,312.4,141.5,312.0,138.5,312.2,92.0,312.8,85.5,312.2,76.0,312.2,64.0,311.5,56.5,311.9,54.0,312.5,53.0,314.0,51.8],[404.0,51.5,420.0,51.5,422.0,51.9,423.0,52.5,424.2,54.0,424.7,56.5,424.7,96.0,423.8,104.0,424.0,124.5,424.3,126.5,425.3,129.0,426.5,131.0,428.0,132.6,431.5,134.6,433.5,135.2,436.5,135.3,448.5,135.3,451.5,135.2,453.5,134.7,455.5,133.7,457.7,131.5,458.6,130.0,459.7,127.0,460.2,124.0,460.5,118.0,460.5,106.5,459.8,100.0,459.8,91.0,459.8,56.5,460.3,54.0,461.0,52.9,463.0,51.8,467.0,51.3,480.5,51.5,482.5,51.9,483.5,52.4,484.6,53.5,485.2,55.5,484.5,64.0,484.7,136.0,484.1,139.5,482.2,145.0,480.6,147.5,478.1,150.5,475.5,152.6,472.0,154.7,468.0,156.6,464.0,157.7,460.0,158.2,452.5,157.8,422.0,157.8,418.0,157.2,411.0,154.2,409.0,153.1,406.5,151.1,403.8,148.0,401.8,144.5,400.3,140.5,399.4,136.0,399.2,133.5,399.2,61.0,398.7,56.5,398.8,54.5,399.2,53.5,400.1,52.5,401.5,51.8],[507.0,51.5,513.5,51.5,520.5,52.2,578.5,52.2,581.0,52.7,582.1,53.5,582.8,54.5,583.2,56.5,583.3,71.5,583.0,73.5,582.0,75.2,581.0,75.8,579.5,76.2,576.5,76.2,569.5,75.5,558.0,75.7,557.0,75.9,555.8,76.5,554.8,77.5,554.4,78.5,554.2,81.5,554.2,105.5,553.8,109.0,554.2,115.5,554.2,157.5,553.6,159.5,552.5,160.6,551.5,161.0,549.0,161.2,543.5,160.8,532.0,160.8,530.0,160.2,528.8,159.0,528.3,157.0,528.8,152.0,528.2,144.0,528.8,138.5,528.8,109.5,528.0,101.5,528.0,95.0,528.7,89.5,528.7,85.5,528.1,79.5,527.7,78.0,527.0,77.1,526.0,76.3,525.0,75.8,522.0,75.5,503.0,75.5,501.0,75.1,499.5,73.9,498.8,72.5,498.7,71.0,498.8,56.5,499.3,54.0,500.5,52.5,501.5,52.0],[180.0,52.5,182.5,52.2,192.0,52.4,193.0,52.8,194.2,54.0,194.7,56.0,193.7,59.5,191.4,65.0,189.7,70.5,187.8,75.5,180.2,98.5,176.9,107.5,174.7,115.0,170.8,126.0,162.8,150.5,157.1,169.5,155.5,171.6,153.0,172.7,149.0,173.2,143.0,173.3,133.0,174.7,131.5,174.6,130.5,174.2,129.4,173.5,128.3,172.0,126.8,167.5,123.7,156.0,120.3,145.0,117.7,135.0,108.4,103.5,107.7,100.5,101.8,81.5,99.5,73.0,94.8,58.5,94.5,55.5,95.5,53.9,96.5,53.3,98.5,53.0,116.5,53.0,118.5,53.4,119.5,53.8,121.2,55.5,122.1,57.5,125.2,68.0,126.9,76.5,129.6,85.5,132.4,97.5,137.6,116.5,138.4,121.0,140.3,128.0,141.0,130.0,141.8,131.5,142.5,132.1,143.5,132.2,144.5,131.9,145.7,130.5,151.6,113.0,153.0,107.5,156.2,97.5,160.4,82.5,163.7,72.5,166.4,62.0,168.3,56.0,169.5,54.2,171.0,53.4],[597.5,52.5,599.0,52.2,617.5,52.4,619.5,53.3,620.2,54.0,620.7,55.5,620.8,161.0,620.7,162.5,619.8,164.0,619.0,164.6,617.0,165.2,602.0,164.7,598.5,164.2,597.1,163.5,596.2,162.5,595.5,160.0,596.0,154.0,596.2,144.0,595.8,137.0,595.8,133.5,596.2,129.0,596.2,114.0,595.3,106.5,595.3,86.5,595.8,83.0,595.8,80.0,595.3,76.5,595.3,62.5,594.7,56.0,595.2,54.0,596.5,52.8],[663.0,52.5,670.5,52.2,678.5,53.0,703.0,53.0,705.5,53.3,710.0,54.4,713.0,55.3,715.0,56.3,717.0,57.5,719.0,59.1,721.2,61.5,724.1,65.5,726.6,70.0,728.2,75.0,729.1,79.5,729.5,83.0,729.5,150.0,729.2,153.0,728.2,157.5,727.2,160.0,725.2,164.0,721.5,168.7,719.5,170.2,716.5,171.8,712.0,173.2,709.0,173.5,699.0,173.5,690.0,172.3,672.0,170.7,661.0,169.1,655.0,167.2,652.0,165.6,649.0,163.6,647.1,162.0,644.4,159.0,641.9,155.0,639.4,148.5,638.8,145.5,638.2,139.0,638.8,116.0,638.2,108.5,638.2,82.0,638.9,75.0,639.8,71.5,641.9,66.5,645.4,61.0,647.5,58.8,650.0,56.9,654.0,54.9,658.5,53.3],[57.0,53.0,80.0,52.8,82.0,53.3,83.3,54.0,84.2,55.5,84.5,57.0,84.3,74.5,84.2,76.0,83.8,77.0,82.5,78.3,81.0,78.8,72.5,78.7,66.5,79.2,39.5,79.2,33.5,79.8,30.0,80.8,28.7,82.0,27.9,83.5,27.5,86.5,27.5,102.0,27.8,105.0,28.5,106.4,29.7,107.5,31.0,108.1,32.5,108.2,35.5,108.2,45.5,106.8,52.0,106.7,61.5,105.4,68.5,105.0,71.5,105.2,73.1,106.5,73.6,107.5,73.8,109.0,73.6,126.0,72.4,128.0,70.5,129.1,49.5,131.7,44.0,131.8,35.5,133.2,32.5,133.3,29.5,134.3,28.4,135.5,27.9,136.5,27.5,139.5,27.5,142.5,27.0,147.0,27.3,159.0,28.0,161.5,29.0,162.8,30.5,163.6,33.0,163.8,41.5,162.7,49.5,161.3,56.5,160.6,63.0,159.3,69.0,158.7,79.5,156.8,81.4,157.0,83.0,158.2,83.7,160.0,83.7,177.0,83.2,179.0,82.0,180.8,80.5,181.6,73.5,183.2,66.5,183.9,36.0,188.9,4.0,195.1,3.0,195.2,1.5,194.7,0.8,194.0,0.3,193.0,0.2,192.0,0.5,187.5,0.5,170.5,1.2,163.0,1.2,75.0,0.5,67.5,0.5,63.0,0.2,58.5,0.4,56.0,2.0,54.2,4.5,53.7,50.5,53.7],[749.0,53.0,756.0,53.7,767.5,53.9,769.0,54.4,771.1,56.0,774.2,62.0,780.7,76.0,789.2,92.5,794.8,104.5,803.2,121.0,806.4,128.0,808.5,131.3,809.5,132.2,810.5,132.5,811.5,132.2,812.1,131.5,812.5,130.0,813.3,118.0,813.3,102.5,812.7,95.0,812.7,77.0,811.8,69.5,811.8,58.5,812.3,56.5,812.8,55.5,814.0,54.3,816.5,53.7,833.5,53.8,836.0,54.4,837.2,55.5,837.7,56.5,838.0,58.0,837.3,66.5,837.3,82.0,837.0,85.5,837.2,92.5,836.7,98.0,836.7,117.5,837.3,125.5,837.2,138.5,837.3,190.5,837.1,192.0,836.6,193.0,835.5,194.0,833.5,194.5,830.5,194.2,816.5,191.6,814.0,190.8,812.0,189.0,809.3,184.0,804.7,173.5,800.8,167.0,797.1,159.0,790.8,147.0,780.8,125.5,774.6,114.0,773.6,112.5,772.5,111.7,771.0,111.8,769.9,113.0,769.3,115.5,769.2,117.5,769.3,125.0,770.0,131.0,769.8,179.0,769.6,180.5,768.6,182.0,767.5,182.6,765.5,182.8,752.5,180.8,749.5,180.7,747.0,179.7,745.9,178.5,745.3,176.0,746.0,169.5,746.0,112.0,745.2,104.0,745.2,73.5,744.5,63.0,744.3,57.0,744.9,55.0,745.5,54.2,747.0,53.3],[242.5,76.0,238.0,76.4,236.0,76.8,233.5,77.9,231.2,79.5,229.8,81.0,228.3,84.5,227.5,91.0,227.5,107.0,226.8,113.0,227.3,123.0,226.8,126.0,226.8,130.0,227.3,132.5,228.9,136.5,230.5,138.5,232.5,140.1,235.5,141.2,252.5,141.2,261.5,139.6,264.5,138.1,266.7,136.0,268.2,133.5,269.1,130.5,269.5,126.5,269.5,118.5,270.2,113.0,270.2,110.0,269.5,103.0,269.7,88.0,269.2,84.0,267.7,80.5,265.8,78.5,263.5,77.0,260.5,75.9,256.5,75.5,248.0,75.5],[672.1,78.5,669.0,79.3,667.0,80.5,665.8,81.5,664.3,84.0,663.3,88.0,662.8,93.0,662.8,128.5,663.3,134.0,664.3,139.0,665.8,141.5,668.0,143.7,670.5,145.2,673.0,146.1,679.5,147.2,686.5,147.4,693.5,148.2,696.5,148.2,698.5,147.7,700.5,146.7,702.7,144.5,703.7,142.5,704.7,138.5,704.7,122.5,705.2,119.0,705.2,116.0,704.8,112.5,704.8,93.0,704.2,88.5,703.2,85.5,701.8,83.0,699.8,81.0,698.0,79.8,695.0,78.8,691.0,78.5,682.5,78.3,675.0,78.3],[536.5,198.2,585.0,199.8,623.5,201.8,662.0,204.9,695.0,208.3,739.5,214.3,775.5,220.4,795.5,224.3,813.5,228.4,832.5,233.3,832.9,234.0,832.5,234.3,831.5,234.2,799.5,228.4,762.5,222.8,725.0,218.3,694.5,215.3,656.0,212.3,612.5,209.8,573.0,208.3,537.0,207.8,536.3,207.5,536.2,207.0,536.2,199.0],[289.0,199.0,302.0,198.8,302.3,199.5,302.3,207.0,302.0,207.6,301.5,207.7,251.5,209.3,209.5,211.3,171.0,213.8,141.0,216.4,107.5,219.8,79.5,223.3,39.0,229.3,5.5,235.3,4.8,235.0,5.5,234.3,27.5,228.9,46.0,224.9,64.0,221.4,99.0,215.4,138.5,209.8,179.5,205.3,209.0,202.8,250.5,200.3]],"bjj":[[334.0,180.3,337.0,180.2,363.5,180.3,366.0,180.9,368.0,181.8,370.8,184.5,372.2,187.0,372.8,190.0,372.7,197.0,370.9,202.0,370.8,203.0,373.2,208.5,373.7,212.5,373.7,218.5,373.2,221.0,372.6,222.5,370.5,225.1,368.0,226.6,366.5,227.1,364.0,227.5,335.5,227.5,334.0,227.1,332.8,226.0,332.3,224.5,332.2,183.0,332.5,181.6,333.0,180.9],[430.0,180.4,436.0,180.4,437.6,181.5,438.2,183.0,438.0,218.5,437.6,221.0,437.2,222.0,436.3,223.5,434.5,225.2,433.0,226.2,430.5,227.2,428.0,227.5,411.5,227.5,408.0,226.7,405.5,225.1,404.3,223.5,402.4,219.0,402.2,217.0,402.3,213.0,402.7,212.0,403.7,211.0,405.5,210.3,410.0,210.4,411.5,210.8,413.1,212.5,414.5,215.8,416.0,217.1,417.5,217.6,423.0,217.6,425.0,216.8,426.7,215.0,427.2,214.0,427.5,211.5,427.5,197.5,426.8,184.0,427.8,181.5,428.5,180.9],[495.5,180.3,499.0,180.2,502.5,180.5,504.0,181.6,504.6,183.0,504.8,217.0,504.2,220.0,503.6,221.5,502.1,224.0,501.0,225.1,499.5,226.2,497.0,227.2,495.0,227.5,477.0,227.5,473.5,226.7,471.5,225.5,469.9,224.0,468.8,222.0,468.3,220.5,468.0,218.0,468.0,213.5,468.4,212.0,469.5,210.8,471.5,210.3,474.5,210.2,475.5,210.3,477.0,210.9,478.0,212.0,478.9,214.5,479.8,216.0,481.5,217.2,483.0,217.6,487.5,217.7,490.0,217.2,491.5,216.2,492.2,215.0,492.7,213.5,492.8,212.0,492.8,184.0,493.3,182.0,494.5,180.8],[346.9,190.5,345.5,191.4,344.9,192.5,344.7,195.5,345.3,197.5,347.0,198.7,349.5,199.0,355.5,199.0,358.0,198.7,360.0,197.6,361.1,196.0,361.3,194.5,361.1,193.0,360.0,191.3,358.5,190.5,356.0,190.2,349.5,190.2],[348.2,208.5,346.1,209.5,344.8,211.5,344.7,214.0,344.9,215.5,345.5,216.4,346.5,217.2,348.0,217.7,349.5,217.8,358.0,217.7,360.0,217.1,361.7,215.5,362.2,213.0,361.6,211.0,360.5,209.6,359.5,208.8,357.5,208.2,353.0,208.0]]};
  var THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.149.0/build/three.min.js";
  function loadThree() {
    if (window.THREE) return Promise.resolve(window.THREE);
    if (window.__threeP) return window.__threeP;
    window.__threeP = new Promise(function (ok, fail) {
      var s = document.createElement("script");
      s.src = THREE_URL; s.async = true;
      s.onload = function () { window.THREE ? ok(window.THREE) : fail(); };
      s.onerror = fail;
      document.head.appendChild(s);
    });
    return window.__threeP;
  }
  function hasGL() { try { var c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch (e) { return false; } }

  function area(a) { var s = 0, n = a.length; for (var i = 0; i < n; i += 2) { var j = (i + 2) % n; s += a[i] * a[j + 1] - a[j] * a[i + 1]; } return s / 2; }
  function dentro(x, y, a) {
    var c = false, n = a.length;
    for (var i = 0, j = n - 2; i < n; j = i, i += 2) {
      var xi = a[i], yi = a[i + 1], xj = a[j], yj = a[j + 1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
  }
  /* laços -> THREE.Shape com furos (o contorno de fora tem área positiva; os furos, negativa) */
  function formas(THREE, loops) {
    var fora = [], furos = [];
    loops.forEach(function (l) { (area(l) > 0 ? fora : furos).push(l); });
    var pts = function (l, P) { var p = new P(); for (var i = 0; i < l.length; i += 2) { var x = l[i] - D.w / 2, y = D.h / 2 - l[i + 1]; if (i) p.lineTo(x, y); else p.moveTo(x, y); } p.closePath(); return p; };
    return fora.map(function (l) {
      var s = pts(l, THREE.Shape);
      furos.forEach(function (h) { if (dentro(h[0], h[1], l)) s.holes.push(pts(h, THREE.Path)); });
      return s;
    });
  }

  function create(wrap, canvas, o) {
    var THREE = window.THREE, small = o.small, reduce = o.reduce;
    var renderer;
    try { renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, powerPreference: "high-performance" }); } catch (e) { return null; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.75 : 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x000000, 0);

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(22, 1, 10, 6000);

    /* estúdio para os reflexos do ouro: softbox em cima, rebatedor quente à esquerda, contraluz à direita */
    var pm = new THREE.PMREMGenerator(renderer), env = new THREE.Scene();
    env.add(new THREE.Mesh(new THREE.BoxGeometry(40, 40, 40), new THREE.MeshBasicMaterial({ color: 0x0d0b09, side: THREE.BackSide })));
    function panel(w, h, hex, k, p) {
      var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k), side: THREE.DoubleSide }));
      m.position.set(p[0], p[1], p[2]); m.lookAt(0, 0, 0); env.add(m);
    }
    panel(18, 5, 0xffffff, 3.2, [0, 14, 6]);
    panel(6, 14, 0xffe9c4, 1.8, [-16, 2, 8]);
    panel(6, 12, 0xf3c98a, 2.4, [15, 0, -6]);
    panel(14, 3, 0xffffff, 0.9, [0, -7, 13]);
    var envRT = pm.fromScene(env, 0.03);
    scene.environment = envRT.texture; pm.dispose();

    var key = new THREE.DirectionalLight(0xfff1dc, 2.2);
    key.position.set(-260, 520, 640); key.castShadow = true;
    key.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
    var sc = key.shadow.camera; sc.left = -520; sc.right = 520; sc.top = 260; sc.bottom = -260; sc.near = 10; sc.far = 2400;
    key.shadow.bias = -0.0004; key.shadow.normalBias = 1.2;
    scene.add(key);
    var rim = new THREE.DirectionalLight(0xffcf87, 1.4); rim.position.set(520, 140, -420); scene.add(rim);
    scene.add(new THREE.HemisphereLight(0xfff6e8, 0x24180c, 0.35));
    /* o brilho que atravessa as letras de tempos em tempos */
    var glint = new THREE.PointLight(0xfff4d6, 0, 900, 1.6); glint.position.set(-700, 60, 160); scene.add(glint);

    var ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 2000), new THREE.ShadowMaterial({ opacity: 0.38 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -D.h / 2 - 34; ground.receiveShadow = true; scene.add(ground);

    /* degradê da frente, igual ao arquivo: #fff1b3 em cima, #efcc76 no meio, #b98b35 embaixo */
    var gc = document.createElement("canvas"); gc.width = 4; gc.height = 256;
    var gx = gc.getContext("2d"), gg = gx.createLinearGradient(0, 0, 0, 256);
    gg.addColorStop(0, "#fff1b3"); gg.addColorStop(0.5, "#efcc76"); gg.addColorStop(1, "#b98b35");
    gx.fillStyle = gg; gx.fillRect(0, 0, 4, 256);
    var grad = new THREE.CanvasTexture(gc); grad.encoding = THREE.sRGBEncoding;
    grad.wrapS = grad.wrapT = THREE.ClampToEdgeWrapping;
    grad.repeat.set(1 / D.w, 1 / D.h); grad.offset.set(0.5, 0.5);

    var DEPTH = 30;
    var ext = { depth: DEPTH, bevelEnabled: true, bevelThickness: 3.2, bevelSize: 1.7, bevelOffset: -0.4, bevelSegments: small ? 2 : 4, curveSegments: 1 };
    var frente = new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: grad, metalness: 0.78, roughness: 0.22, clearcoat: 0.5, clearcoatRoughness: 0.2, envMapIntensity: 1.5 });
    var lado = new THREE.MeshPhysicalMaterial({ color: 0x9c7128, metalness: 1, roughness: 0.36, envMapIntensity: 1.1 });
    var gOuro = new THREE.ExtrudeGeometry(formas(THREE, D.ouro), ext);
    var ouro = new THREE.Mesh(gOuro, [frente, lado]);
    var bjjMat = new THREE.MeshPhysicalMaterial({ color: 0xf5f2ea, metalness: 0.05, roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.15 });
    var gBjj = new THREE.ExtrudeGeometry(formas(THREE, D.bjj), ext);
    var bjj = new THREE.Mesh(gBjj, bjjMat);
    [ouro, bjj].forEach(function (m) { m.castShadow = true; m.receiveShadow = true; m.position.z = -DEPTH / 2; });
    var group = new THREE.Group(), pivot = new THREE.Group();
    group.add(ouro); group.add(bjj); pivot.add(group); scene.add(pivot);

    /* tema: no claro o BJJ fica grafite e a sombra mais leve; no escuro, branco perolado */
    function tema() {
      var black = document.documentElement.getAttribute("data-look") === "black";
      bjjMat.color.set(black ? 0xf5f2ea : 0x14110e); bjjMat.roughness = black ? 0.32 : 0.3; bjjMat.metalness = black ? 0.05 : 0.1;
      ground.material.opacity = black ? 0.55 : 0.13;
      renderOnce();
    }
    var mo = new MutationObserver(tema);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-look"] });

    function resize() {
      var w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      var tn = Math.tan(camera.fov * Math.PI / 360);
      /* a logo ocupa ~84% da largura do quadro */
      var d = Math.max((D.w / 0.84 / 2) / (tn * camera.aspect), (D.h / 0.62 / 2) / tn);
      camera.position.set(0, d * 0.16, d);
      camera.lookAt(0, -6, 0);
      camera.updateProjectionMatrix();
      renderOnce();
    }

    var S = { rise: reduce ? 1 : 0, tx: 0, ty: 0, cx: 0, cy: 0, t: 0, g: -1 };
    function pose() {
      var r = S.rise, e = 1 - Math.pow(1 - r, 3);
      /* deitada para trás e afundada -> em pé, de frente, levemente virada */
      pivot.rotation.x = (1 - e) * -1.15 + S.cy * 0.22 + Math.sin(S.t * 0.55) * 0.012;
      pivot.rotation.y = -0.08 * e + S.cx * 0.42 + Math.sin(S.t * 0.4) * 0.05 * (o.fine ? 0.4 : 1);
      pivot.position.y = (1 - e) * -120;
      group.position.y = 4;
      if (S.g >= 0) { glint.position.x = -760 + S.g * 1520; glint.intensity = Math.sin(S.g * Math.PI) * 3.2; } else glint.intensity = 0;
    }
    function renderOnce() { if (!raf) { pose(); renderer.render(scene, camera); } }

    function onMove(e) {
      var r = wrap.getBoundingClientRect();
      S.tx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
      S.ty = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1));
    }
    var hov = o.hover || wrap;
    function onLeave() { S.tx = 0; S.ty = 0; }
    if (o.fine && !reduce) { hov.addEventListener("mousemove", onMove); hov.addEventListener("mouseleave", onLeave); }

    var raf = 0, last = 0, visible = false, nextGlint = 1.6;
    function frame(now) {
      raf = requestAnimationFrame(frame);
      var dt = Math.min(0.033, (now - (last || now)) / 1000); last = now;
      S.t += dt;
      S.cx += (S.tx - S.cx) * 0.06; S.cy += (S.ty - S.cy) * 0.06;
      /* brilho: atravessa a logo em 1,6 s, a cada ~6 s */
      if (S.g >= 0) { S.g += dt / 1.6; if (S.g >= 1) { S.g = -1; nextGlint = S.t + 5.5; } }
      else if (S.t > nextGlint && S.rise > 0.9) S.g = 0;
      pose();
      renderer.render(scene, camera);
    }
    function start() { if (!raf && visible && !reduce) { last = 0; raf = requestAnimationFrame(frame); } }
    function stop() { cancelAnimationFrame(raf); raf = 0; }
    var io = new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) start(); else stop(); });
    io.observe(canvas);
    window.addEventListener("resize", resize);
    resize(); tema();

    return {
      rise: function (v) { S.rise = v; renderOnce(); },
      destroy: function () {
        stop(); io.disconnect(); mo.disconnect(); window.removeEventListener("resize", resize);
        hov.removeEventListener("mousemove", onMove); hov.removeEventListener("mouseleave", onLeave);
        gOuro.dispose(); gBjj.dispose(); frente.dispose(); lado.dispose(); bjjMat.dispose(); grad.dispose(); envRT.dispose(); renderer.dispose();
      }
    };
  }

  /* liga sozinho em qualquer página com a logo do rodapé */
  function init() {
    var wrap = document.querySelector(".foot-logo-wrap");
    if (!wrap || !hasGL() || !("IntersectionObserver" in window)) return;
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    var io = new IntersectionObserver(function (es) {
      if (!es[0].isIntersecting) return;
      io.disconnect();
      loadThree().then(function () {
        var cv = document.createElement("canvas");
        cv.className = "foot-gl"; cv.setAttribute("aria-hidden", "true");
        wrap.appendChild(cv);
        var api = null;
        try { api = create(wrap, cv, { small: !fine || window.innerWidth < 900, reduce: reduce, fine: fine, hover: wrap.closest(".foot") }); }
        catch (e) { if (window.console) console.warn("Logo3D", e); }
        if (!api) { cv.remove(); return; }
        wrap.classList.add("gl");
        /* a rolagem levanta a logo do chão (com GSAP, amarrada à rolagem; sem ele, de uma vez) */
        if (window.gsap && window.ScrollTrigger && !reduce) {
          ScrollTrigger.create({ trigger: wrap, start: "top bottom", end: "bottom bottom", scrub: 0.8, onUpdate: function (s) { api.rise(s.progress); } });
          ScrollTrigger.refresh();
        } else api.rise(1);
      }, function () {});
    }, { rootMargin: "700px 0px" });
    io.observe(wrap);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
